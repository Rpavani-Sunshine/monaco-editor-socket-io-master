var editor  
var issocket = false 
var isadmin = false 
var users = {}  
var contentWidgets = {} 
var decorations = {}    
/* monaco editor with cdn */
require.config({
    paths: {
        'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.13.1/min/vs'
    }
})
window.MonacoEnvironment = {
    getWorkerUrl: function (workerId, label) {
        return `data:text/javascriptcharset=utf-8,${encodeURIComponent(`
        self.MonacoEnvironment = {
          baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.13.1/min'
        }
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.13.1/min/vs/base/worker/workerMain.js')`
      )}`
    }
}

function insertCSS(id, color) {
    var style = document.createElement('style')
    style.type = 'text/css'
    style.innerHTML += '.' + id + ' { background-color:' + color + '}\n' //Selection Design
    style.innerHTML += `
    .${id}one { 
        background: ${color};
        width:2px !important 
    }`  //cursor Design
    document.getElementsByTagName('head')[0].appendChild(style)
}

function insertWidget(e) {
    contentWidgets[e.user] = {
        domNode: null,
        position: {
            lineNumber: 0,
            column: 0
        },
        getId: function () {
            return 'content.' + e.user
        },
        getDomNode: function () {
            if (!this.domNode) {
                this.domNode = document.createElement('div')
                this.domNode.innerHTML = e.user
                this.domNode.style.background = e.color
                this.domNode.style.color = 'black'
                this.domNode.style.opacity = 0.8
                this.domNode.style.width = 'max-content'
            }
            return this.domNode
        },
        getPosition: function () {
            return {
                position: this.position,
                preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW]
            }
        }
    }
}

function changeWidgetPosition(e) {
    contentWidgets[e.user].position.lineNumber = e.selection.endLineNumber
    contentWidgets[e.user].position.column = e.selection.endColumn

    editor.removeContentWidget(contentWidgets[e.user])
    editor.addContentWidget(contentWidgets[e.user])
}


function changeSeleciton(e) {
    var selectionArray = []
    if (e.selection.startColumn == e.selection.endColumn && e.selection.startLineNumber == e.selection.endLineNumber) { //if cursor - 커서일 때
        e.selection.endColumn++
        selectionArray.push({
            range: e.selection,
            options: {
                className: `${e.user}one`,
                hoverMessage: {
                    value: e.user
                }
            }
        })

    } else {    
        selectionArray.push({   
            range: e.selection,
            options: {
                className: e.user,
                hoverMessage: {
                    value: e.user
                }
            }
        })
    }
    for (let data of e.secondarySelections) {     
        if (data.startColumn == data.endColumn && data.startLineNumber == data.endLineNumber) {
            selectionArray.push({
                range: data,
                options: {
                    className: `${e.user}one`,
                    hoverMessage: {
                        value: e.user
                    }
                }
            })
        } else
            selectionArray.push({
                range: data,
                options: {
                    className: e.user,
                    hoverMessage: {
                        value: e.user
                    }
                }
            })
    }
    decorations[e.user] = editor.deltaDecorations(decorations[e.user], selectionArray)  
}

function changeText(e) {
    editor.getModel().applyEdits(e.changes) 
}
require(["vs/editor/editor.main"], function () {
    var htmlCode = `Hello to collabrative text-editor`    

    editor = monaco.editor.create(document.getElementById("editor"), {
        value: htmlCode,
        language: "javascript",
        fontSize: 15,
        readOnly: true,
        fontFamily: "Nanum Gothic Coding",  
    })
    //Monaco Event
    editor.onDidChangeModelContent(function (e) { 
        if (issocket == false) {
            socket.emit('key', e)
        } else
            issocket = false
    })
    editor.onDidChangeCursorSelection(function (e) {    
        socket.emit('selection', e)
    })

    //Connect Socket
    var socket = io('/main')    

    socket.on('connected', function (data) { 
        users[data.user] = data.color
        insertCSS(data.user, data.color)
        insertWidget(data)
        decorations[data.user] = []
        if (isadmin === true) {
            editor.updateOptions({readOnly: false})
            socket.emit("filedata", editor.getValue())
        }
    })
    socket.on('userdata', function (data) {     
        if (data.length == 1)
        isadmin = true
        for (var i of data) {
            users[i.user] = i.color
            insertCSS(i.user, i.color)
            insertWidget(i)
            decorations[i.user] = []
        }
    })
    socket.on('resetdata', function (data) {   
        issocket = true
        editor.setValue(data)
        editor.updateOptions({readOnly: false})
        issocket = false
    })
    socket.on('admin', function (data) {    
        isadmin = true
        editor.updateOptions({readOnly: false})
    })
    socket.on('selection', function (data) {  
        changeSeleciton(data)
        changeWidgetPosition(data)
        if (data.user !== socket.id) {
            // Extract the cursor position from the event data
            var cursorPosition = {
                lineNumber: data.selection.endLineNumber,
                column: data.selection.endColumn
            };
    
            // Set the cursor position in the editor
            editor.setPosition(cursorPosition);
        }
    })
  
    socket.on('exit', function (data) { 
        editor.removeContentWidget(contentWidgets[data])
        editor.deltaDecorations(decorations[data], [])
        delete decorations[data]
        delete contentWidgets[data]
    })
    
    socket.on('key', function (data) { 
        issocket = true
        changeText(data)
    })

    // Function to handle text changes
function handleTextChange(change) {
    // Apply the change to the shared document
    htmlCode = applyChange(htmlCode, change);

    // Broadcast the change to other clients
    socket.emit('change', change);
}

// Apply a text change to the document
function applyChange(document, change) {
    // For simplicity, assume changes are represented as { index, text }
    var index = change.index;
    var text = change.text;

    // Apply the change to the document
    return document.slice(0, index) + text + document.slice(index);
}

// Apply received change to the document
socket.on('change', function(change) {
    // Resolve conflicts if any
    var resolvedChange = resolveConflict(change);

    // Apply the change to the local document
    htmlCode = applyChange(htmlCode, resolvedChange);
});

// Function to resolve conflicts
function resolveConflict(receivedChange) {
    return receivedChange;
}
  
})