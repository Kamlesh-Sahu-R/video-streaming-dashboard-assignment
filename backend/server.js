const express = require('express');           
const { spawn } = require('child_process');   
const cors = require('cors');                 
const path = require('path');                 
const http = require('http');                 
const socketio = require('socket.io');        
const fs = require('fs');                     
const app = express();     

app.use(cors({ origin: 'http://localhost:3000' }));   

const server = http.createServer(app);                    
const io = socketio(server, { cors: { origin: '*' } });   

const RTSP_URL = 'rtsp://13.60.76.79:8554/live2';         
const HLS_ROOT = path.join(__dirname, 'public', 'hls');   

// Ensure hls dirs exist
if (!fs.existsSync(HLS_ROOT)) fs.mkdirSync(HLS_ROOT, { recursive: true });  

const FFmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';  

const N_STREAMS = 6;                    
const serverStart = Date.now();    

// spawn ffmpeg for i stream 
function spawnFFmpeg(i) {

  const outDir = path.join(HLS_ROOT, `stream${i}`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const args = [
    '-rtsp_transport', 'tcp',       
    '-i', RTSP_URL,                 
    '-an',                          
    '-c:v', 'libx264',              
    '-preset', 'veryfast',          
    '-tune', 'zerolatency',         
    '-r', '25',                     
    '-g', '50',                     
    '-keyint_min', '50',            
    '-sc_threshold', '0',           
    '-b:v', '1000k',                
    '-maxrate', '1200k',            
    '-bufsize', '2000k',            
    '-vf', 'scale=640:-2',          
    '-f', 'hls',                    
    '-hls_time', '1',               
    '-hls_list_size', '6',          
    '-hls_flags', 'delete_segments+program_date_time',   
    '-hls_segment_filename', path.join(outDir, 'seg_%03d.ts'),
    path.join(outDir, 'index.m3u8')
  ];

  console.log(`Spawning ffmpeg for stream ${i}: ${FFmpegPath} ${args.join(' ')}`);

  
  const ff = spawn(FFmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  ff.stdout.on('data', (d) => {
    // ffmpeg logs
    // console.log(`ffmpeg${i} stdout: ${d}`);
  });

  ff.stderr.on('data', (d) => {
    const s = d.toString();
    // keep limited logs
    if (!s.includes('frame=')) console.log(`[ffmpeg${i}] ${s}`);      
  });

  // Ensures 24/7 uptime even if FFmpeg crashes.
  ff.on('close', (code) => {
    console.log(`ffmpeg${i} exited with ${code}`);
    // optionally restart
    setTimeout(() => spawnFFmpeg(i), 2000);
  });

  return ff;
}

// spawn N streams
const ffProcesses = [];
for (let i = 1; i <= N_STREAMS; i++) {
  ffProcesses.push(spawnFFmpeg(i));
}

// Serve static HLS files
app.use('/hls', express.static(path.join(__dirname, 'public', 'hls')));   
app.use(express.static(path.join(__dirname, 'public')));               

// Endpoint to list streams
app.get('/streams', (req, res) => {
  const streams = [];
  for (let i = 1; i <= N_STREAMS; i++) {
    streams.push({
      id: i,
      url: `/hls/stream${i}/index.m3u8`
    });
  }
  res.json({ streams, serverStart });
});

// Socket.IO sync namespace
io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // Immediately send serverStart for initial sync
  socket.emit('server-info', { serverStart });

  // Every 1 second send server clock; include playlist sequence if desired
  const t = setInterval(() => {
    const payload = {
      now: Date.now()
    };
    socket.emit('clock', payload);
  }, 1000);

  socket.on('disconnect', () => {
    clearInterval(t);
    console.log('client disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`HLS root: ${HLS_ROOT}`);
});