let curPlayer = 1;
let curMove = 'start';
let startNode = {};
let startPoints = new Array();
let grid = new Map();
let gameover = false;

const gridSize = 4;
const initMsg = "INITIALIZE";
const updateTextMsg = 'UPDATE_TEXT';
const nodeClickedMsg = "NODE_CLICKED";
const validStartNodeMsg = "VALID_START_NODE";
const invalidStartNodeMsg = "INVALID_START_NODE";
const validEndNodeMsg = "VALID_END_NODE";
const invalidEndNodeMsg = "INVALID_END_NODE";
const gameOverMsg = "GAME_OVER_MSG";

app.ports.request.subscribe((message) => {
    message = JSON.parse(message);
    
    if (message.msg == initMsg) {
        initGrid();
        sendInitialize();
    }

    if (message.msg == nodeClickedMsg && !gameover) {
        handleNodeClicked(message.body);
    }
});

function initGrid() {
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const key = i + ',' + j;
            const point = {avail: true, diagonals: []}
            grid.set(key, point);
        }
    }
}

function isStartNodeSet() {
    return startNode.hasOwnProperty('x') && startNode.hasOwnProperty('y');
}

function getCoords(node) {
    return node.x + ',' + node.y;
}

function isStartNodeValid(node) {
    if (startPoints.length == 0) {
        return true;
    }

    if (startPoints.indexOf(getCoords(node)) >= 0) {
        return true;
    }

    return false;
}

function isEndNodeStartNode(endnode) {
    return startNode.x === endnode.x && startNode.y === endnode.y;
}

function isPointTaken(points) {
    return grid.get(points).avail === false;
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

function getLine(endnode) {
    const diffs = getNodeDiffs(endnode);

    let xnums = [];
    let ynums = [];
    let xcoord = -1;
    let ycoord = -1;
    let size = 0;
    let coordsarr = [];

    if (diffs[0] !== 0) {
        xnums = getNumsBetween(startNode.x, endnode.x)
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
        let coords = "";
        if (xcoord > -1) {
            coords = xcoord + ',' + ynums[i];
        } else if (ycoord > -1) {
            coords = xnums[i] + ',' + ycoord;
        } else {
            coords = xnums[i] + ',' + ynums[i];
        }
        coordsarr.push(coords);
    }

    return coordsarr;
}

// gets all the numbers between num1 and num2
// if num2 < num1, reverse the numbers
function getNumsBetween(num1, num2) {
    if (num1 == num2) {
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
    let isOpen = true;
    let points = getLine(endnode);

    for (let i = 1; i < points.length; i++) {
        if (isPointTaken(points[i])) {
            isOpen = false;
        }
    }
    return isOpen;
}

function addLineToGrid(endnode) {
    const line = getLine(endnode);
    const diagonal = isLineDiagonal(endnode);
    for (let i = 0; i < line.length; i++) {
        let point = grid.get(line[i]);
        point.avail = false;
        if (diagonal) {
            if (i == 0) {
                point.diagonals.push(line[i+1]);
            } else if (i == line.length - 1) {
                point.diagonals.push(line[i-1]);
            } else {
                point.diagonals.push(line[i+1]);
                point.diagonals.push(line[i-1]);
            }
        }
        grid.set(line[i], point);
    }
}

function getLineDirection(line) {
    const firstpoint = line[0].split(',');
    const lastpoint = line[line.length - 1].split(',');

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

function isPointBlocked(point, direction) {
    let split = point.split(',');
    let x1 = '';
    let y2 = '';
    if (direction.charAt(0) === "n") {
        y2 = parseInt(split[1]) - 1;
    }
    if (direction.charAt(0) === "s") {
        y2 = parseInt(split[1]) + 1;
    }
    if (direction.charAt(1) === "e") {
        x1 = parseInt(split[0]) + 1;
    }
    if (direction.charAt(1) === "w") {
        x1 = parseInt(split[0]) - 1;
    }

    let checkpoint1 = grid.get(x1 + "," + split[1]);
    let checkpoint2 = split[0] + "," + y2;

    return checkpoint1.diagonals.indexOf(checkpoint2) >= 0;
}

function hasDiagonalOverlap(endnode) {
    if (!isLineDiagonal(endnode)) {
        return false;
    }

    const points = getLine(endnode);
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
    curPlayer = curPlayer == 1 ? 2 : 1;
}

function setStartPoints(node) {
    if (startPoints.length == 0) {
        startPoints = [getCoords(startNode), getCoords(node)];
        return;
    }

    let index = startPoints.indexOf(getCoords(startNode));
    startPoints[index] = getCoords(node);
}

// TODO - add diagonal point checking
function isPointAvail(point, base, direction = "") {
    let gridpoint = grid.get(point);

    if (!gridpoint.avail) {
        return false;
    } else if (direction != "" && isPointBlocked(base, direction)) {
        return false;
    }

    return true;
}

function hasNoMoves(startPoint) {
    let splitPoint = startPoint.split(',');
    let xpoint = splitPoint[0] - 1;
    let ypoint = splitPoint[1] - 1;

    let nomoves = true;

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (i == 1 && j == 1) {
                continue;
            }

            let x = xpoint + i;
            let y = ypoint + j;
            let coords = x + ',' + y;
            let direction = getLineDirection([startPoint, coords]);
            
            if (grid.has(coords) && isPointAvail(coords, startPoint, direction)) {
                nomoves = false;
            }
        }
    }
    
    return nomoves;
}

function setStartNode(node) {
    startNode = node;
}

function isGameOver() {
    if (hasNoMoves(startPoints[0]) && hasNoMoves(startPoints[1])) {
        return true;
    }
    return false;
}

function handleNodeClicked(node) {
    if (isStartNodeSet()) {
        if (isEndNodeValid(node)) {
            handleValidEndNode(node);
        } else {
            sendInvalidEndNode();
        }
        setStartNode({});
        return;
    }

    if (isStartNodeValid(node)) {
        setStartNode(node);
        sendValidStartNode();
    } else {
        sendInvalidStartNode();
    }
    return;
}

function handleValidEndNode(node) {
    setStartPoints(node);
    setCurPlayer();
    addLineToGrid(node);

    if (isGameOver()) {
        gameover = true;
        sendGameOver(node);
    } else {
        sendValidEndNode(node);
    }
}

function getPlayerHeading() {
    return "Player " + curPlayer;
}

function getAwaitingMsg() {
    return "Awaiting " + getPlayerHeading(curPlayer) + "'s Move";
}

function sendInitialize() {
    sendResponse(initMsg, getPlayerHeading(), getAwaitingMsg());
}

// TODO - call this at somepoint
function sendUpdateText() {
    sendResponse(updateTextMsg, getPlayerHeading(), "Are you asleep?");
}

function sendValidStartNode() {
    sendResponse(validStartNodeMsg, getPlayerHeading());
}

function sendInvalidStartNode() {
    sendResponse(invalidStartNodeMsg, getPlayerHeading(), "You must start on either end of the path!")
}

function sendValidEndNode(endnode) {
    sendResponse(validEndNodeMsg, getPlayerHeading(), getAwaitingMsg(), getNewLineObj(endnode));
}

function sendInvalidEndNode() {
    sendResponse(invalidEndNodeMsg, getPlayerHeading(), "Invalid move. Try again.");
}

function sendGameOver(endnote) {
    sendResponse(gameOverMsg, "Game Over", "Player " + curPlayer + " wins!", getNewLineObj(endnote));
}

function getNewLineObj(endnode) {
    return {
        end: endnode,
        start: startNode
    }
}

function sendResponse(apimsg, heading = null, footermsg = null, newline = null) {
    app.ports.response.send({
        msg: apimsg,
        body: {
            heading: heading,
            message: footermsg,
            newLine: newline
        }
    });
}