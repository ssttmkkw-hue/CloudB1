import { CombatScreen } from './Combat';
import { MapScreen } from './MapScreen';
import { Overlays, PeekLayer, TopBar } from './components';
import {
  BossRelicScreen, ClassSelectScreen, CodexOverlay, EventScreen, MenuOverlay, MenuScreen, OverScreen,
  RestScreen, RewardScreen, SelectScreen, ShopScreen, TreasureScreen,
} from './Screens';
import { useStore } from './store';

function GameView() {
  const s = useStore();
  const run = s.run!;
  const t = run.screen.t;
  const body = (() => {
    switch (t) {
      case 'map': return <MapScreen />;
      case 'combat': return <CombatScreen />;
      case 'reward': return <RewardScreen />;
      case 'rest': return <RestScreen />;
      case 'shop': return <ShopScreen />;
      case 'event': return <EventScreen />;
      case 'treasure': return <TreasureScreen />;
      case 'bossRelic': return <BossRelicScreen />;
      case 'select': return <SelectScreen />;
      case 'over': return <OverScreen />;
    }
  })();
  return (
    <div class={`game act-${run.act} scr-${t}`}>
      {t !== 'over' && <TopBar />}
      <div class="game-body" key={t}>{body}</div>
    </div>
  );
}

export function App() {
  const s = useStore();
  return (
    <div class="app">
      {s.view === 'menu' && <MenuScreen />}
      {s.view === 'classSelect' && <ClassSelectScreen />}
      {s.view === 'game' && s.run && <GameView />}
      <Overlays />
      <MenuOverlay />
      <CodexOverlay />
      <PeekLayer />
      <div class="toasts">{s.toasts.map((t) => <div class="toast" key={t.id}>{t.text}</div>)}</div>
    </div>
  );
}
