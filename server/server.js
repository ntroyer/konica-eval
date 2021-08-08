const gridSize = 4;
const updateTime = 10000;
const initMsg = "INITIALIZE";
const updateTextMsg = 'UPDATE_TEXT';
const nodeClickedMsg = "NODE_CLICKED";
const validStartNodeMsg = "VALID_START_NODE";
const invalidStartNodeMsg = "INVALID_START_NODE";
const validEndNodeMsg = "VALID_END_NODE";
const invalidEndNodeMsg = "INVALID_END_NODE";
const gameOverMsg = "GAME_OVER_MSG";

let curPlayer = 1;
let curMove = 'start';
let startNode = {};
let pathEnds = new Array();
let grid = new Map();
let gameComplete = false;
let timeout;

app.ports.request.subscribe((message) => {
    message = JSON.parse(message);
    clearTimeout(timeout);

    if (gameComplete) {
        return;
    }
    
    if (message.msg === initMsg) {
        initGrid();
        sendInitializeMsg();
    }

    if (message.msg === nodeClickedMsg) {
        handleNodeClicked(message.body);
    }

    timeout = setTimeout(() => {
        if (!gameComplete) {
            sendUpdateTextMsg();
        }
    }, updateTime);
});

function initGrid() {
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const key = i + ',' + j;
            const point = {avail: true, diagonals: []};
            grid.set(key, point);
        }
    }
}

function isStartNodeSet() {
    return startNode.hasOwnProperty('x') && startNode.hasOwnProperty('y');
}

function getGraphIndexFromNode(node) {
    return getGraphIndex(node.x, node.y);
}

function getGraphIndex(x, y) {
    return x + ',' + y;
}

function isStartNodeValid(node) {
    if (pathEnds.length === 0) {
        return true;
    }

    if (pathEnds.indexOf(getGraphIndexFromNode(node)) >= 0) {
        return true;
    }

    return false;
}

function isEndNodeStartNode(endnode) {
    return startNode.x === endnode.x && startNode.y === endnode.y;
}

function isPointTaken(point) {
    return grid.get(point).avail === false;
}

function isLineValid(endnode) {
    if (!isLineOctilinear(endnode)) {
        return false;
    }

    if (hasDiagonalOverlap(endnode)) {
        return false;
    }

    return isLineOpen(endnode);
}

// we know our line is diagonal if the difference in distance between two points is the same for both our x and y coords and > 0
function isLineDiagonal(endnode) {
    const diffs = getNodeDiffs(endnode);

    return diffs[0] > 0 && diffs[0] === diffs[1];
}

function getNodeDiffs(endnode) {
    return [Math.abs(startNode.x - endnode.x), Math.abs(startNode.y - endnode.y)];
}

function getLineIndexes(endnode) {
    const diffs = getNodeDiffs(endnode);

    let xnums = [];
    let ynums = [];
    let xcoord = -1;
    let ycoord = -1;
    let size = 0;
    let indexes = [];

    if (diffs[0] !== 0) {
        xnums = getNumsBetween(startNode.x, endnode.x);
        size = xnums.length;
    }
    if (diffs[0] === 0) {
        xcoord = startNode.x;
    }
    if (diffs[1] !== 0) {
        ynums = getNumsBetween(startNode.y, endnode.y);
        size = ynums.length;
    }
    if (diffs[1] === 0) {
        ycoord = startNode.y;
    }

    for (let i = 0; i < size; i++) {
        let index = "";
        if (xcoord > -1) {
            index = xcoord + ',' + ynums[i];
        } else if (ycoord > -1) {
            index = xnums[i] + ',' + ycoord;
        } else {
            index = xnums[i] + ',' + ynums[i];
        }
        indexes.push(index);
    }

    return indexes;
}

// gets all the numbers between num1 and num2
// if num2 < num1, reverse the numbers
function getNumsBetween(num1, num2) {
    if (num1 === num2) {
        return [num1];
    }

    let nums = [];
    let smallnum = num1;
    let largenum = num2;

    if (num2 < num1) {
        smallnum = num2;
        largenum = num1;
    }

    for (let i = smallnum; i < largenum; i++) {
        nums.push(i);
    }
    nums.push(largenum);

    if (num2 < num1) {
        nums.reverse();
    }

    return nums;
}

// we know a line is octilinear given the following:
// all points are on the same axis (either x or y) OR
// all points have the same difference between x and y axis
function isLineOctilinear(endnode) {
    const diffs = getNodeDiffs(endnode);
    if (diffs[0] === 0 || diffs[1] === 0 || diffs[0] === diffs[1]) {
        return true;
    }

    return false;
}

// return true if all points in the line except for the first aren't already taken
function isLineOpen(endnode) {
    const indexes = getLineIndexes(endnode);
    let isOpen = true;

    for (let i = 1; i < indexes.length; i++) {
        if (isPointTaken(indexes[i])) {
            isOpen = false;
        }
    }
    return isOpen;
}

function addLineToGrid(endnode) {
    const indexes = getLineIndexes(endnode);
    for (let i = 0; i < indexes.length; i++) {
        let point = grid.get(indexes[i]);
        point.avail = false;
        if (isLineDiagonal(endnode)) {
            if (i === 0) {
                point.diagonals.push(indexes[i+1]);
            } else if (i === indexes.length - 1) {
                point.diagonals.push(indexes[i-1]);
            } else {
                point.diagonals.push(indexes[i+1]);
                point.diagonals.push(indexes[i-1]);
            }
        }
        grid.set(indexes[i], point);
    }
}

function getLineDirection(indexes) {
    const firstpoint = indexes[0].split(',');
    const lastpoint = indexes[indexes.length - 1].split(',');

    if (firstpoint[0] < lastpoint[0] && firstpoint[1] < lastpoint[1]) {
        return "se";
    }
    if (firstpoint[0] > lastpoint[0] && firstpoint[1] < lastpoint[1]) {
        return "sw";
    }
    if (firstpoint[0] > lastpoint[0] && firstpoint[1] > lastpoint[1]) {
        return "nw";
    }
    if (firstpoint[0] < lastpoint[0] && firstpoint[1] > lastpoint[1]) {
        return "ne";
    }

    return "";
}

function isPointBlocked(index, direction) {
    if (direction === "") {
        return false;
    }

    let splitIndex = index.split(',');
    let x1 = 0;
    let x2 = parseInt(splitIndex[0]);
    let y1 = parseInt(splitIndex[1]);
    let y2 = 0;

    if (direction.charAt(0) === "n") {
        y2 = y1 - 1;
    }
    if (direction.charAt(0) === "s") {
        y2 = y1 + 1;
    }
    if (direction.charAt(1) === "e") {
        x1 = x2 + 1;
    }
    if (direction.charAt(1) === "w") {
        x1 = x2 - 1;
    }

    return grid.get(getGraphIndex(x1, y1)).diagonals.indexOf(getGraphIndex(x2, y2)) >= 0;
}

function hasDiagonalOverlap(endnode) {
    if (!isLineDiagonal(endnode)) {
        return false;
    }

    const points = getLineIndexes(endnode);
    const direction = getLineDirection(points);
    if (direction === "") {
        return false;
    }

    let hasOverlap = false;

    for (let i = 0; i < points.length - 1; i++) {
        if (isPointBlocked(points[i], direction)) {
            hasOverlap = true;
        }
    }

    return hasOverlap;
}

function isEndNodeValid(endnode) {
    if (isEndNodeStartNode(endnode)) {
        return false;
    }

    if (!isLineValid(endnode)) {
        return false;
    }
    
    return true;
}

function setCurPlayer() {
    curPlayer = curPlayer === 1 ? 2 : 1;
}

function setPathEnds(endnode) {
    const startNodeIndex = getGraphIndexFromNode(startNode);
    const endNodeIndex = getGraphIndexFromNode(endnode);
    if (pathEnds.length === 0) {
        pathEnds = [startNodeIndex, endNodeIndex];
        return;
    }

    pathEnds[pathEnds.indexOf(startNodeIndex)] = endNodeIndex;
}

// if the point is part of a line, or is blocked by a diagonal line, the point cannot be selected
// otherwise, it can be
function canPathEndConnectToPoint(pathEnd, point) {
    if (!grid.has(point)) {
        return false;
    }

    if (!grid.get(point).avail) {
        return false;
    } 
    
    if (isPointBlocked(pathEnd, getLineDirection([pathEnd, point]))) {
        return false;
    }

    return true;
}

// check the points immediately surrounding the start point
// if all the points have a line, or are being blocked by a diagonal line, the start point has no moves
function hasNoMoves(pathEnd) {
    const splitPoint = pathEnd.split(',');
    const xpoint = splitPoint[0] - 1;
    const ypoint = splitPoint[1] - 1;

    let nomoves = true;

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (i === 1 && j === 1) {
                continue;
            }
            
            if (canPathEndConnectToPoint(pathEnd, getGraphIndex(xpoint + i, ypoint + j))) {
                nomoves = false;
            }
        }
    }
    
    return nomoves;
}

function setStartNode(node) {
    startNode = node;
}

function setGameComplete(isComplete) {
    gameComplete = isComplete;
}

function isGameOver() {
    if (hasNoMoves(pathEnds[0]) && hasNoMoves(pathEnds[1])) {
        return true;
    }
    return false;
}

function handleNodeClicked(node) {
    if (isStartNodeSet()) {
        if (isEndNodeValid(node)) {
            handleValidEndNode(node);
        } else {
            sendInvalidEndNodeMsg();
        }
        setStartNode({});
        return;
    }

    if (isStartNodeValid(node)) {
        setStartNode(node);
        sendValidStartNodeMsg();
    } else {
        sendInvalidStartNodeMsg();
    }
    return;
}

function handleValidEndNode(node) {
    setPathEnds(node);
    setCurPlayer();
    addLineToGrid(node);

    if (isGameOver()) {
        setGameComplete(true);
        sendGameOverMsg(node);
    } else {
        sendValidEndNodeMsg(node);
    }
}

function getPlayerHeading() {
    return "Player " + curPlayer;
}

function getAwaitingMsg() {
    return "Awaiting " + getPlayerHeading(curPlayer) + "'s Move";
}

function sendInitializeMsg() {
    sendResponse(initMsg, getPlayerHeading(), getAwaitingMsg());
}

function sendUpdateTextMsg() {
    sendResponse(updateTextMsg, getPlayerHeading(), "Are you asleep?");
}

function sendValidStartNodeMsg() {
    sendResponse(validStartNodeMsg, getPlayerHeading());
}

function sendInvalidStartNodeMsg() {
    sendResponse(invalidStartNodeMsg, getPlayerHeading(), "You must start on either end of the path!")
}

function sendValidEndNodeMsg(endnode) {
    sendResponse(validEndNodeMsg, getPlayerHeading(), getAwaitingMsg(), getNewLineObj(endnode));
}

function sendInvalidEndNodeMsg() {
    sendResponse(invalidEndNodeMsg, getPlayerHeading(), "Invalid move. Try again.");
}

function sendGameOverMsg(endnote) {
    sendResponse(gameOverMsg, "Game Over", "Player " + curPlayer + " wins!", getNewLineObj(endnote));
}

function getNewLineObj(endnode) {
    return {
        end: endnode,
        start: startNode
    }
}

function sendResponse(apimsg, heading = null, footermsg = null, newline = null) {
    try {
        app.ports.response.send({
            msg: apimsg,
            body: {
                heading: heading,
                message: footermsg,
                newLine: newline
            }
        });
    } catch (error) {
        console.error(error);
    }
}