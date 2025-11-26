import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import io from 'socket.io-client';
import './App.css';

// let streams = [
//   { id: 1, url: "/hls/stream1/index.m3u8" },
//   { id: 2, url: "/hls/stream2/index.m3u8" },
//   { id: 3, url: "/hls/stream3/index.m3u8" },
//   { id: 4, url: "/hls/stream4/index.m3u8" },
//   { id: 5, url: "/hls/stream5/index.m3u8" },
//   { id: 6, url: "/hls/stream6/index.m3u8" }
// ];

const SERVER = process.env.REACT_APP_SERVER || 'http://localhost:8001';

function VideoTile({ streamUrl, socket, id, syncInfo }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [ready, setReady] = useState(false);

  // apply hls
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      
      video.src = SERVER + streamUrl;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 10,
      });
      hlsRef.current = hls;
      hls.loadSource(SERVER + streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setReady(true);
      });
    } else {
      console.error('HLS not supported');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }
  }, [streamUrl]);

  // Sync logic: respond to clock messages
  useEffect(() => {
    if (!socket) return;
    //let lastClock = null;

    function handleClock(payload) {
      // lastClock = payload;
      // compute target playback time
      // We'll use a simple model: serverStart is when streaming started.
      // Map: playback_time_seconds = (now_ms - serverStart_ms)/1000 - playbackLiveLag
      const serverStart = syncInfo.serverStart;
      const nowServerMs = payload.now;
      const liveLag = syncInfo.liveLag || 2.5; // estimated live latency in seconds (playlist segment duration * list_size). Tune this.
      const target = Math.max(0, (nowServerMs - serverStart) / 1000 - liveLag);

      const video = videoRef.current;
      if ((!video || isNaN(video.duration)) && !ready) return;

      // measure drift
      const current = video.currentTime || 0;
      const drift = current - target;

      const absDrift = Math.abs(drift);

      // If large drift, seek
      if (absDrift > 0.5) {
        try {
          video.currentTime = target;
        } catch (e) {
          // ignore if can't seek right now
        }
      } else if (absDrift > 0.05) {
        // small drift -> nudge playbackRate for smooth correction
        const nudge = -drift * 0.1; // proportional control
        const rate = 1 + nudge;
        video.playbackRate = Math.min(1.05, Math.max(0.95, rate));
      } else {
        // on target
        if (video.playbackRate !== 1) video.playbackRate = 1;
      }
    }

    socket.on('clock', handleClock);
    socket.on('server-info', (d) => {
      // maybe use
    });

    return () => {
      socket.off('clock', handleClock);
    }
  }, [socket, syncInfo, ready]);

  // autoply attempt
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = async () => {
      try {
        await v.play();
      } catch (err) {
        // could be autoplay policy; user must click to enable sound/play
      }
    };
    tryPlay();
  }, []);

  return (
    <div className="video-tile">
      <video ref={videoRef} controls muted playsInline style={{ width: '100%', height: '100%', background: '#000' }} />
      <div className="tile-overlay">#{id}</div>
    </div>
  );
}

function App() {
  const [streams, setStreams] = useState([]);
  const [socket, setSocket] = useState(null);
  const [syncInfo, setSyncInfo] = useState({ serverStart: Date.now(), liveLag: 2.5 });

  useEffect(() => {
    // fetch streams
    fetch(`${SERVER}/streams`).then(res => res.json()).then(data => {
      setStreams(data.streams);
      setSyncInfo(prev => ({ ...prev, serverStart: data.serverStart }));
    });

    const s = io(SERVER);
    setSocket(s);

    s.on('server-info', (d) => {
      setSyncInfo(prev => ({ ...prev, serverStart: d.serverStart }));
    });

    return () => s.disconnect();
  }, []);

  // console.log(streams);
  // console.log(socket);
  // console.log(syncInfo);

  // grid layout style: responsive 2x3 or 3x2
  return (
    <div className="App">
      <h2>Video Streaming Dashboard Assignment — {streams.length} streams</h2>
      <div className="grid">
        {streams.map((st) => (
          <VideoTile 
            key={st.id} 
            id={st.id} 
            streamUrl={st.url}
            socket={socket} 
            syncInfo={syncInfo}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
