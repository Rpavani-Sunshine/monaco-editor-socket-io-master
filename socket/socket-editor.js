var conId = 1 
var colors = [  
    '#DDFFAA',
    '#95E0C8',
    '#E18060',
    '#FFCBA4'
] 
var users = {} 

module.exports = function (io, nsp){
    var server = io.of(nsp) 
    server.on("connection", function (socket){
        users[socket.id] = {}   
        
        users[socket.id].user = socket.user = "user" + conId    
        users[socket.id].admin = socket.admin = false
        users[socket.id].color = socket.color = colors[conId % colors.length] 
        

        conId++ 
        console.log('[Socket.IO] ['+ nsp +'] : Connect ' + socket.id) 
        if (server.sockets.length == 1){    
            socket.emit('admin')    
            socket.admin = true
            
            
        }
        else
            socket.emit('userdata', Object.values(users))   
        socket.broadcast.emit('connected', {user : socket.user, color : socket.color}) 

        socket.on('selection', function (data) {       
            data.color = socket.color
            data.user = socket.user
            socket.broadcast.emit('selection', data) 
        }) 
        socket.on('filedata', function(data){   
            socket.broadcast.emit('resetdata', data)    
        })      
        socket.on('disconnect', function (data) {   
            console.log('[Socket.IO] ['+ nsp +'] : disConnect ' + socket.id) 
            socket.broadcast.emit("exit", users[socket.id].user)    
            delete users[socket.id] 
        })
        socket.on('key', function (data) {      
            data.user = socket.user
            socket.broadcast.emit('key', data)
        })
    })
    return server
}