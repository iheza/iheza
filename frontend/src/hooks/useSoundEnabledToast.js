/**
 * Sound-Enabled Toast
 * A drop-in replacement for `import { toast } from 'sonner'`
 * that automatically plays appropriate sound effects.
 * 
 * Usage:
 *   import { toast } from '../hooks/useSoundEnabledToast';
 *   toast.success('Item saved!');
 *   toast.error('Failed!');
 */

import { toast as sonnerToast } from 'sonner';
import { SoundEffects } from './useNotificationSound';

// Create a proxy that wraps sonner toast with sound effects
const toast = new Proxy(sonnerToast, {
  apply(target, thisArg, args) {
    // Default toast - play info sound
    SoundEffects.info();
    return Reflect.apply(target, thisArg, args);
  }
});

// Override specific methods with appropriate sounds
const originalSuccess = sonnerToast.success;
const originalError = sonnerToast.error;
const originalWarning = sonnerToast.warning;
const originalInfo = sonnerToast.info;

toast.success = (message, options) => {
  SoundEffects.success();
  return originalSuccess(message, options);
};

toast.error = (message, options) => {
  SoundEffects.error();
  return originalError(message, options);
};

toast.warning = (message, options) => {
  SoundEffects.warning();
  return originalWarning(message, options);
};

toast.info = (message, options) => {
  SoundEffects.info();
  return originalInfo(message, options);
};

// Copy over all other properties from sonner toast
Object.keys(sonnerToast).forEach(key => {
  if (!toast[key]) {
    toast[key] = sonnerToast[key];
  }
});

export { toast };
export default toast;
