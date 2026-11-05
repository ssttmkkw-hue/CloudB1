import { render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';

render(<App />, document.getElementById('app')!);

// 阻止 iOS 双指缩放 / 双击缩放干扰游戏操作
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300) e.preventDefault();
  lastTouch = now;
}, { passive: false });
