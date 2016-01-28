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

    function InjectPayload(msg,payload) {
        var result = {};
        for (var i in msg) {
            result[i] = msg[i];
        }
        result.payload = payload;
        return result;
    }

    function IteratorNode(n) {

        RED.nodes.createNode(this, n);
        this.property = n.property;
        this.inputFlow = n.inputFlow;
        this.saveOutput = n.saveOutput;
        this.recursive = n.recursive;

        var propertyParts = n.property.split("."),
            node = this;

        var processing = [], outputs = [], originals = [];

        function sendNext(msg) {
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

        function onInput(msg) {
            //Find the property specified in the config
            var prop = propertyParts.reduce(function (obj, i) {
                return obj[i] || {}
            }, msg);

            //If the property is an Array then iterate over it
            if ( ( node.recursive || ! processing.length ) && Array.isArray(prop) ) {
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
            sendNext(node,msg);
        }

        this.on('input', onInput);
    }

    RED.nodes.registerType('Serial Iterator',IteratorNode);
};
