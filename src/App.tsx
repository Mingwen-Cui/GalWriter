/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactFlowProvider } from '@xyflow/react';

import { StoryEditor } from './components/StoryEditor';

export default function App() {
  return (
    <ReactFlowProvider>
      <StoryEditor />
    </ReactFlowProvider>
  );
}
