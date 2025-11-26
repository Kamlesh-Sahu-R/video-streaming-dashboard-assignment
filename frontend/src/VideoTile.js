import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import './VideoTile.css';

const SERVER = 'http://localhost:8000';

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

export default VideoTile;
