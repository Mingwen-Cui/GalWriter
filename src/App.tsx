/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoryEditor } from './components/StoryEditor';
import { ReactFlowProvider } from '@xyflow/react';

export default function App() {
  return (
    <ReactFlowProvider>
      <StoryEditor />
    </ReactFlowProvider>
  );
}
