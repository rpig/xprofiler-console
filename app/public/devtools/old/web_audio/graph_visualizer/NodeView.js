// Copyright 2019 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// A class that represents a node of a graph, consisting of the information needed to layout the
// node and display the node. Each node has zero or more ports, including input, output, and param ports.
WebAudio.GraphVisualizer.NodeView = class {
  /**
   * @param {!WebAudio.GraphVisualizer.NodeCreationData} data
   * @param {string} label
   */
  constructor(data, label) {
    this.id = data.nodeId;
    this.type = data.nodeType;
    this.numberOfInputs = data.numberOfInputs;
    this.numberOfOutputs = data.numberOfOutputs;
    this.label = label;

    this.size = {width: 0, height: 0};
    // Position of the center. If null, it means the graph layout has not been computed
    // and this node should not be rendered. It will be set after layouting.
    this.position = null;

    /** @type {!WebAudio.GraphVisualizer.NodeLayout} */
    this._layout = {
      inputPortSectionHeight: 0,
      outputPortSectionHeight: 0,
      maxTextLength: 0,
      totalHeight: 0,
    };
    /** @type {!Map<string, !WebAudio.GraphVisualizer.Port>} */
    this.ports = new Map();

    this._initialize(data);
  }

  /**
   * @param {!WebAudio.GraphVisualizer.NodeCreationData} data
   */
  _initialize(data) {
    this._updateNodeLayoutAfterAddingNode(data);
    this._setupInputPorts();
    this._setupOutputPorts();
  }

  /**
   * Add an AudioParam to this node.
   * Note for @method removeParamPort: removeParamPort is not necessary because it will only happen
   * when the parent NodeView is destroyed. So there is no need to remove port individually
   * when the whole NodeView will be gone.
   * @param {string} paramId
   * @param {string} paramType
   */
  addParamPort(paramId, paramType) {
    const paramPorts = this.getPortsByType(WebAudio.GraphVisualizer.PortTypes.Param);
    const numberOfParams = paramPorts.length;

    const {x, y} = WebAudio.GraphVisualizer.NodeRendererUtility.calculateParamPortXY(
        numberOfParams, this._layout.inputPortSectionHeight);
    this._addPort({
      id: WebAudio.GraphVisualizer.generateParamPortId(this.id, paramId),
      type: WebAudio.GraphVisualizer.PortTypes.Param,
      label: paramType,
      x,
      y,
    });

    this._updateNodeLayoutAfterAddingParam(numberOfParams + 1, paramType);

    // The position of output ports may be changed if adding a param increases the total height.
    this._setupOutputPorts();
  }

  /**
   * @param {!WebAudio.GraphVisualizer.PortTypes} type
   * @return {!Array<!WebAudio.GraphVisualizer.Port>}
   */
  getPortsByType(type) {
    const result = [];
    this.ports.forEach(port => {
      if (port.type === type)
        result.push(port);
    });
    return result;
  }

  /**
   * Use number of inputs and outputs to compute the layout
   * for text and ports.
   * Credit: This function is mostly borrowed from Audion/
   *      `audion.entryPoints.handleNodeCreated_()`.
   *      https://github.com/google/audion/blob/master/js/entry-points/panel.js
   * @param {!WebAudio.GraphVisualizer.NodeCreationData} data
   */
  _updateNodeLayoutAfterAddingNode(data) {
    // Even if there are no input ports, leave room for the node label.
    const {
      TotalInputPortHeight,
      LeftSideTopPadding,
      BottomPaddingWithoutParam,
      TotalOutputPortHeight,
      NodeLabelFontStyle,
    } = WebAudio.GraphVisualizer.GraphStyles;
    const inputPortSectionHeight = TotalInputPortHeight * Math.max(1, data.numberOfInputs) + LeftSideTopPadding;
    this._layout.inputPortSectionHeight = inputPortSectionHeight;
    this._layout.outputPortSectionHeight = TotalOutputPortHeight * data.numberOfOutputs;

    // Use the max of the left and right side heights as the total height.
    // Include a little padding on the left.
    this._layout.totalHeight =
        Math.max(inputPortSectionHeight + BottomPaddingWithoutParam, this._layout.outputPortSectionHeight);

    // Update max length with node label.
    const nodeLabelLength = WebAudio.GraphVisualizer.measureTextWidth(this.label, NodeLabelFontStyle);
    this._layout.maxTextLength = Math.max(this._layout.maxTextLength, nodeLabelLength);

    this._updateNodeSize();
  }

  /**
   * After adding a param port, update the node layout based on the y value
   * and label length.
   * @param {number} numberOfParams
   * @param {string} paramType
   */
  _updateNodeLayoutAfterAddingParam(numberOfParams, paramType) {
    // The height after adding param ports and input ports.
    // Include a little padding on the left.
    const leftSideMaxHeight = this._layout.inputPortSectionHeight +
        numberOfParams * WebAudio.GraphVisualizer.GraphStyles.TotalParamPortHeight +
        WebAudio.GraphVisualizer.GraphStyles.BottomPaddingWithParam;

    // Use the max of the left and right side heights as the total height.
    this._layout.totalHeight = Math.max(leftSideMaxHeight, this._layout.outputPortSectionHeight);

    // Update max length with param label.
    const paramLabelLength =
        WebAudio.GraphVisualizer.measureTextWidth(paramType, WebAudio.GraphVisualizer.GraphStyles.ParamLabelFontStyle);
    this._layout.maxTextLength = Math.max(this._layout.maxTextLength, paramLabelLength);

    this._updateNodeSize();
  }

  _updateNodeSize() {
    this.size = {
      width: Math.ceil(
          WebAudio.GraphVisualizer.GraphStyles.LeftMarginOfText + this._layout.maxTextLength +
          WebAudio.GraphVisualizer.GraphStyles.RightMarginOfText),
      height: this._layout.totalHeight,
    };
  }

  // Setup the properties of each input port.
  _setupInputPorts() {
    for (let i = 0; i < this.numberOfInputs; i++) {
      const {x, y} = WebAudio.GraphVisualizer.NodeRendererUtility.calculateInputPortXY(i);
      this._addPort({
        id: WebAudio.GraphVisualizer.generateInputPortId(this.id, i),
        type: WebAudio.GraphVisualizer.PortTypes.In,
        x,
        y,
      });
    }
  }

  // Setup the properties of each output port.
  _setupOutputPorts() {
    for (let i = 0; i < this.numberOfOutputs; i++) {
      const portId = WebAudio.GraphVisualizer.generateOutputPortId(this.id, i);
      const {x, y} =
          WebAudio.GraphVisualizer.NodeRendererUtility.calculateOutputPortXY(i, this.size, this.numberOfOutputs);
      if (this.ports.has(portId)) {
        // Update y value of an existing output port.
        const port = this.ports.get(portId);
        port.x = x;
        port.y = y;
      } else {
        this._addPort({
          id: portId,
          type: WebAudio.GraphVisualizer.PortTypes.Out,
          x,
          y,
        });
      }
    }
  }

  /** @param {!WebAudio.GraphVisualizer.Port} port */
  _addPort(port) {
    this.ports.set(port.id, port);
  }
};

/**
 * Generates the port id for the input of node.
 * @param {string} nodeId
 * @param {number | undefined} inputIndex
 * @return {string}
 */
WebAudio.GraphVisualizer.generateInputPortId = (nodeId, inputIndex) => {
  return `${nodeId}-input-${inputIndex || 0}`;
};

/**
 * Generates the port id for the output of node.
 * @param {string} nodeId
 * @param {number | undefined} outputIndex
 * @return {string}
 */
WebAudio.GraphVisualizer.generateOutputPortId = (nodeId, outputIndex) => {
  return `${nodeId}-output-${outputIndex || 0}`;
};

/**
 * Generates the port id for the param of node.
 * @param {string} nodeId
 * @param {string} paramId
 * @return {string}
 */
WebAudio.GraphVisualizer.generateParamPortId = (nodeId, paramId) => {
  return `${nodeId}-param-${paramId}`;
};

// A label generator to convert UUID of node to shorter label to display.
// Each graph should have its own generator since the node count starts from 0.
WebAudio.GraphVisualizer.NodeLabelGenerator = class {
  constructor() {
    this._totalNumberOfNodes = 0;
  }

  /**
   * Generates the label for a node of a graph.
   * @param {string} nodeType
   * @return {string}
   */
  generateLabel(nodeType) {
    // To make the label concise, remove the suffix "Node" from the nodeType.
    if (nodeType.endsWith('Node'))
      nodeType = nodeType.slice(0, nodeType.length - 4);

    // Also, use an integer to replace the long UUID.
    this._totalNumberOfNodes += 1;
    const label = `${nodeType} ${this._totalNumberOfNodes}`;
    return label;
  }
};

/**
 * Get the text width using given font style.
 * @param {string} text
 * @param {?string} fontStyle
 * @return {number}
 */
WebAudio.GraphVisualizer.measureTextWidth = (text, fontStyle) => {
  if (!WebAudio.GraphVisualizer._contextForFontTextMeasuring)
    WebAudio.GraphVisualizer._contextForFontTextMeasuring = createElement('canvas').getContext('2d');

  const context = WebAudio.GraphVisualizer._contextForFontTextMeasuring;
  context.save();
  context.font = fontStyle;
  const width = UI.measureTextWidth(context, text);
  context.restore();
  return width;
};
