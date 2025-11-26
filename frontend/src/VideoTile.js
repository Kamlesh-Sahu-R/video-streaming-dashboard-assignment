import { useEffect, useRef } from "react";
import Hls from "hls.js";

const VideoTile = ({ url }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS error:", data);
      });

      return () => {
        hls.destroy();
      };
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = url; 
    }
  }, [url]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      controls
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    ></video>
  );
};

export default VideoTile;
