/**
 * Copyright 2016 mcarboni@redant.com
 *
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/



 module.exports = function(RED) {
    'use strict';

    function IteratorNode(n) {

        RED.nodes.createNode(this, n);
        this.property = n.property;
        this.inputFlow = n.inputFlow;
        this.saveOutput = n.saveOutput;
        this.recursive = n.recursive;
        this.storeId = n.storeId;

        var propertyParts = n.property.split('.'),
            node = this;

        //For multiple flows at the same time
        var flow_id = 0,
            flow_processing = {},
            flow_outputs = {},
            flow_originals = {};

        //Variables internals to the node, really usefull if on this node there's only one flow at time
        var _processing = [],
            _outputs = [],
             _originals = [];

        function sendNext(msg,processing,outputs,originals) {
            //Check from where takes the properties
            var output = node.inputFlow === 'input'
                        ? RED.util.cloneMessage(originals[0])
                        : RED.util.cloneMessage(msg);
            //If there's data to send
            if ( processing[0].length ) {
                var elem = processing[0].shift();
                //Add the extracted elem to the message
                output.payload = elem;
                //In case is the data from the input message, readd the information about the iterations
                node.send([output,null]);
            } else {
                //Delete now useless data
                processing.shift();
                //Finished
                if ( node.saveOutput ) {
                    //Set as payload the output
                    output.payload = outputs[0];
                    outputs.shift();
                }
                if ( node.inputFlow ) {
                    originals.shift();
                }
                if ( node.recursive && processing.length ) {
                    onInput(output);
                } else {
                    node.send([null,output]);
                }
            }
        }

        function onInput(_msg) {
            var msg = RED.util.cloneMessage(_msg);
            //Find the property specified in the config
            var prop = propertyParts.reduce(function (obj, i) {
                return (typeof obj === 'object')
                        ? obj[i]
                        : obj;
            }, msg);

            var processing,outputs,originals,actually_processing;

            //In the case the id of the flow needs to be stored in the msg
            if ( node.storeId ) {
                var id;
                //Set if is a feedback
                actually_processing  = Array.isArray(msg.__serialIteratorId);
                //If is not processing and the input isn't an array, the data is invalid
                if (!actually_processing && !Array.isArray(prop) ) {
                    return ;
                }
                //Check if is a an input
                if (( node.recursive || !actually_processing  ) && Array.isArray(prop)) {
                    //New id
                    id = flow_id++;
                    flow_processing[id] = [];
                    flow_outputs[id]    = [];
                    flow_originals[id]  = [];
                    //Add the id to the msg
                    if (!msg.__serialIteratorId) {
                        msg.__serialIteratorId = [];
                    }
                    msg.__serialIteratorId.unshift(id);
                } else {
                    //It's a feedback
                    id = msg.__serialIteratorId[0];
                }
                processing  = flow_processing[id];
                outputs     = flow_outputs[id];
                originals   = flow_originals[id];
            } else {
                //In case of only one flow at time
                processing  = _processing;
                outputs     = _outputs;
                originals   = _originals;
                actually_processing = processing.length;
            }

            //If the property is an Array then iterate over it
            if ( ( node.recursive || !actually_processing  ) && Array.isArray(prop) ) {
                //Save the array
                processing.unshift(prop);
                if ( node.inputFlow === 'input') {
                    //And the original message
                    originals.unshift(msg);
                }
                if ( node.saveOutput ) {
                    //Create an array to save the outputs from the feedback
                    outputs.unshift([]);
                }
            } else {
                //In the opposite case it's a feedback
                if ( node.saveOutput ) {
                    //Save the output in an Array
                    outputs[0].push(msg.payload);
                }
            }
            //Send the next one
            sendNext(msg,processing,outputs,originals);
        }

        this.on('input', onInput);
    }

    RED.nodes.registerType('Serial Iterator',IteratorNode);
};
