import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './lib/installDeliveredOrderHardDeleteButton';
import './lib/installUsernameLogin';
import { bootstrapAuthoritativeSync } from './lib/bootstrapAuthoritativeSync';

async function bootstrap() {
  // Supabase is the shared source of truth. Refresh the local cache before the UI
  // reads it so two browsers cannot display different repair-order snapshots.
  await bootstrapAuthoritativeSync();

  createRoot(document.getElementById('root')!).render(<App />);
}

void bootstrap();
