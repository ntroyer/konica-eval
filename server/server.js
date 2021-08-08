'use strict';

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

function getDefaultPoint() {
    return {
        avail: true, 
        diagonals: []
    };
}

function initGrid() {
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            grid.set(getPointIndex(i, j), getDefaultPoint());
        }
    }
}

function isStartNodeSet() {
    return startNode.hasOwnProperty('x') && startNode.hasOwnProperty('y');
}

function getPointIndexFromNode(node) {
    return getPointIndex(node.x, node.y);
}

function getPointIndex(x, y) {
    return x + ',' + y;
}

function isStartNodeValid(node) {
    if (pathEnds.length === 0) {
        return true;
    }

    if (pathEnds.indexOf(getPointIndexFromNode(node)) >= 0) {
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

function isLineHorizontal(diffs) {
    return diffs[0] === 0;
}

function isLineVertical(diffs) {
    return diffs[1] === 0;
}

function getLineIndexes(endnode) {
    const diffs = getNodeDiffs(endnode);
    const xnums = diffs[0] !== 0 ? getNumsBetween(startNode.x, endnode.x) : [];
    const ynums = diffs[1] !== 0 ? getNumsBetween(startNode.y, endnode.y) : [];

    let indexes = [];
    for (let i = 0; i < Math.max(xnums.length, ynums.length); i++) {
        let x = isLineHorizontal(diffs) ? startNode.x : xnums[i];
        let y = isLineVertical(diffs) ? startNode.y : ynums[i];
        indexes.push(getPointIndex(x, y));
    }

    return indexes;
}

// gets all the numbers between num1 and num2
// if num2 < num1, reverse the numbers
function getNumsBetween(num1, num2) {
    if (num1 === num2) {
        return [num1];
    }

    const largenum = Math.max(num1, num2)
    let nums = [];
    for (let i = Math.min(num1, num2); i < largenum; i++) {
        nums.push(i);
    }
    nums.push(largenum);

    return num2 < num1 ? nums.reverse() : nums;
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
            if (i > 0) {
                point.diagonals.push(indexes[i-1]);
            }
            if (i < indexes.length - 1) {
                point.diagonals.push(indexes[i+1]);
            }
        }
        grid.set(indexes[i], point);
    }
}

function getLineDirection(indexes) {
    const firstIndex = indexes[0].split(',');
    const lastIndex = indexes[indexes.length - 1].split(',');

    if (firstIndex[0] < lastIndex[0] && firstIndex[1] < lastIndex[1]) {
        return "se";
    }
    if (firstIndex[0] > lastIndex[0] && firstIndex[1] < lastIndex[1]) {
        return "sw";
    }
    if (firstIndex[0] > lastIndex[0] && firstIndex[1] > lastIndex[1]) {
        return "nw";
    }
    if (firstIndex[0] < lastIndex[0] && firstIndex[1] > lastIndex[1]) {
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

    return grid.get(getPointIndex(x1, y1)).diagonals.indexOf(getPointIndex(x2, y2)) >= 0;
}

function hasDiagonalOverlap(endnode) {
    if (!isLineDiagonal(endnode)) {
        return false;
    }

    const indexes = getLineIndexes(endnode);
    const direction = getLineDirection(indexes);
    if (direction === "") {
        return false;
    }

    let hasOverlap = false;

    for (let i = 0; i < indexes.length - 1; i++) {
        if (isPointBlocked(indexes[i], direction)) {
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
    const startNodeIndex = getPointIndexFromNode(startNode);
    const endNodeIndex = getPointIndexFromNode(endnode);
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
    const splitIndex = pathEnd.split(',');
    const x = splitIndex[0] - 1;
    const y = splitIndex[1] - 1;

    let nomoves = true;

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (i === 1 && j === 1) {
                continue;
            }
            
            if (canPathEndConnectToPoint(pathEnd, getPointIndex(x + i, y + j))) {
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