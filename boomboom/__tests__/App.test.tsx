import ReactTestRenderer from 'react-test-renderer';

import App from '../App';

test('renders without crashing', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(() => renderer?.unmount());
});
