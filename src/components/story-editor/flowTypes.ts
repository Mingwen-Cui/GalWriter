import { MemoizedAINode } from '../AINode';
import { MemoizedBackgroundNode } from '../BackgroundNode';
import { MemoizedBatchReplaceNode } from '../BatchReplaceNode';
import { MemoizedCharacterNode } from '../CharacterNode';
import { CustomEdge } from '../CustomEdge';
import { MemoizedGroupNode } from '../GroupNode';
import { MemoizedNumberConditionNode } from '../NumberConditionNode';
import { MemoizedPlotStructureNode } from '../PlotStructureNode';
import { MemoizedSceneNode } from '../SceneNode';
import { MemoizedStoryNode } from '../StoryNode';
import { MemoizedSummaryNode } from '../SummaryNode';
import { MemoizedTextNode } from '../TextNode';

export const nodeTypes = {
  storyNode: MemoizedStoryNode,
  backgroundNode: MemoizedBackgroundNode,
  groupNode: MemoizedGroupNode,
  aiNode: MemoizedAINode,
  textNode: MemoizedTextNode,
  summaryNode: MemoizedSummaryNode,
  numberConditionNode: MemoizedNumberConditionNode,
  batchReplaceNode: MemoizedBatchReplaceNode,
  plotStructureNode: MemoizedPlotStructureNode,
  characterNode: MemoizedCharacterNode,
  sceneNode: MemoizedSceneNode,
};

export const edgeTypes = {
  customEdge: CustomEdge,
};
