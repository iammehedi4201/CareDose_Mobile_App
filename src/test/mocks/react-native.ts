export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};

export const Platform = {
  OS: 'android',
  select: <T>(obj: { android?: T; ios?: T; default?: T }): T | undefined =>
    obj.android ?? obj.default,
};

let mockWindowDimensions = { width: 375, height: 812, scale: 2, fontScale: 1 };

export const __setMockWindowWidth = (width: number, height = 812, fontScale = 1): void => {
  mockWindowDimensions = { width, height, scale: 2, fontScale };
};

export const useWindowDimensions = () => mockWindowDimensions;

export const Keyboard = {
  addListener: () => ({ remove: () => {} }),
  dismiss: () => {},
};

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
};

export const Linking = {
  openSettings: async (): Promise<void> => {},
  openURL: async (): Promise<void> => {},
};

export const Share = {
  share: async (): Promise<{ action: string }> => ({ action: 'sharedAction' }),
};

export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const Image = 'Image';
export const ActivityIndicator = 'ActivityIndicator';
export const Switch = 'Switch';
export const Modal = 'Modal';
export const StatusBar = 'StatusBar';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';

class MockAnimatedValue {
  private _value: number;
  constructor(initial: number) {
    this._value = initial;
  }
  interpolate(): MockAnimatedValue {
    return this;
  }
  setValue(next: number): void {
    this._value = next;
  }
}

export const Animated = {
  Value: MockAnimatedValue,
  View: 'View',
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  spring: () => ({ start: (cb?: () => void) => cb?.() }),
  parallel: (anims: Array<{ start: (cb?: () => void) => void }>) => ({
    start: (cb?: () => void) => {
      anims.forEach((a) => a.start());
      cb?.();
    },
  }),
};
