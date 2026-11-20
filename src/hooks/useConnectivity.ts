import { useEffect, useState } from 'react';
import {
  ConnectivitySnapshot,
  getConnectivitySnapshot,
  subscribeConnectivity,
  verifyInternetReachability,
  flushPendingOperations,
} from '../services/connectivity';

export function useConnectivity() {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(() => getConnectivitySnapshot());

  useEffect(() => {
    return subscribeConnectivity(setSnapshot);
  }, []);

  const retryConnection = async () => {
    const ok = await verifyInternetReachability(true);
    if (ok) {
      await flushPendingOperations();
    }
    return ok;
  };

  return {
    ...snapshot,
    retryConnection,
  };
}
