import VideoTile from "./VideoTile";
import "./App.css";

const streams = [
  { id: 1, url: "/hls/stream1/index.m3u8" },
  { id: 2, url: "/hls/stream2/index.m3u8" },
  { id: 3, url: "/hls/stream3/index.m3u8" },
  { id: 4, url: "/hls/stream4/index.m3u8" },
  { id: 5, url: "/hls/stream5/index.m3u8" },
  { id: 6, url: "/hls/stream6/index.m3u8" },
];

function App() {
  return (
    <div>
      <h2>Video Streaming Dashboard — {streams.length} streams</h2>
      <div></div>
    <div className="grid">
      {streams.map((s) => (
        <VideoTile key={s.id} url={s.url} />
      ))}
    </div>
    </div>
  );
}

export default App;
