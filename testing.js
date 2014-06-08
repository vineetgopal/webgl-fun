var canvas;
var gl;
var squareVerticesBuffer;
var squareVerticesColorBuffer;
var mvMatrix;
var shaderProgram;
var vertexPositionAttribute;
var vertexColorAttribute;
var perspectiveMatrix;
var squareRotation = 0.0;
var lastSquareUpdateTime;
var squareXOffset = 0.0;
var squareYOffset = 0.0;
var squareZOffset = 0.0;
var xIncValue = 0.02;
var yIncValue = -0.04;
var zIncValue = 0.03;

function start() {
  var canvas = document.getElementById("glcanvas");
  gl = canvas.getContext("webgl");
  gl.clearColor(0.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
  gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
  gl.depthFunc(gl.LEQUAL);                                // Near things obscure far things
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);      // Clear the color as well as the depth buffer.

  initShaders();
  initBuffers();

  setInterval(drawScene, 15);
}

function initShaders() {
  var fragmentShader = getShader(gl, "shader-fs");
  var vertexShader = getShader(gl, "shader-vs");
  
  // Create the shader program
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  
  gl.useProgram(shaderProgram);
  
  vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(vertexPositionAttribute);

  vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
  gl.enableVertexAttribArray(vertexColorAttribute);
}

function getShader(gl, id) {
  var shaderScript, theSource, currentChild, shader;
  
  shaderScript = document.getElementById(id);
  
  theSource = "";
  currentChild = shaderScript.firstChild;
  
  while(currentChild) {
    if (currentChild.nodeType == currentChild.TEXT_NODE) {
      theSource += currentChild.textContent;
    }
    
    currentChild = currentChild.nextSibling;
  }

  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
     // Unknown shader type
     return null;
  }

  gl.shaderSource(shader, theSource);
    
  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
      return null;
  }
    
  return shader;
}

var horizAspect = 480.0/640.0;

function initBuffers() {
  squareVerticesBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBuffer);
  
  var vertices = [
    1.0,  1.0,  0.0,
    -1.0, 1.0,  0.0,
    1.0,  -1.0, 0.0,
    -1.0, -1.0, 0.0
  ];
  
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  var colors = [
    1.0,  1.0,  1.0,  1.0,    // white
    1.0,  0.0,  0.0,  1.0,    // red
    0.0,  1.0,  0.0,  1.0,    // green
    0.0,  0.0,  1.0,  1.0     // blue
  ];
  squareVerticesColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
}

function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  perspectiveMatrix = makePerspective(45, 640.0/480.0, 0.1, 100.0);
  
  loadIdentity();
  mvTranslate([-0.0, 0.0, -6.0]);
  mvPushMatrix();
  mvRotate(squareRotation, [1, 0, 1]);
  mvTranslate([squareXOffset, squareYOffset, squareZOffset]);
  gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBuffer);
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesColorBuffer);
  gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);

  setMatrixUniforms();
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  mvPopMatrix();

  var currentTime = (new Date).getTime();
  if (lastSquareUpdateTime) {
    var delta = currentTime - lastSquareUpdateTime;
    
    squareRotation += (30 * delta) / 1000.0;
    squareXOffset += xIncValue * ((30 * delta) / 1000.0);
    squareYOffset += yIncValue * ((30 * delta) / 1000.0);
    squareZOffset += zIncValue * ((30 * delta) / 1000.0);
    
    if (Math.abs(squareYOffset) > 2.5) {
      xIncValue = -xIncValue;
      yIncValue = -yIncValue;
      zIncValue = -zIncValue;
    }
  }
  
  lastSquareUpdateTime = currentTime;
}

function loadIdentity() {
  mvMatrix = Matrix.I(4);
}

function multMatrix(m) {
  mvMatrix = mvMatrix.x(m);
}

function mvTranslate(v) {
  multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}

function setMatrixUniforms() {
  var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

  var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));
}

var mvMatrixStack = [];

function mvPushMatrix(m) {
  if (m) {
    mvMatrixStack.push(m.dup());
    mvMatrix = m.dup();
  } else {
    mvMatrixStack.push(mvMatrix.dup());
  }
}

function mvPopMatrix() {
  if (!mvMatrixStack.length) {
    throw("Can't pop from an empty matrix stack.");
  }
  
  mvMatrix = mvMatrixStack.pop();
  return mvMatrix;
}

function mvRotate(angle, v) {
  var inRadians = angle * Math.PI / 180.0;
  
  var m = Matrix.Rotation(inRadians, $V([v[0], v[1], v[2]])).ensure4x4();
  multMatrix(m);
} 