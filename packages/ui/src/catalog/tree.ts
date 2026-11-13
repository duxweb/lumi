import { z } from 'zod'

/**
 * A node of a hierarchical choice (Tree, TreeSelect, Cascader). A node with
 * `children: undefined` and no `isLeaf: true` may still have children that the
 * host loads on demand; `children: []` or `isLeaf: true` is a leaf.
 */
export interface TreeNode {
  label: string
  value: string | number | boolean
  disabled?: boolean | undefined
  /** A bundled Lumi or HugeIcons icon name drawn before the label. */
  icon?: string | undefined
  isLeaf?: boolean | undefined
  children?: TreeNode[] | undefined
}

export const treeNodeSchema: z.ZodType<TreeNode, TreeNode> = z.lazy(() => z.strictObject({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  disabled: z.boolean().optional(),
  icon: z.string().optional(),
  isLeaf: z.boolean().optional(),
  children: z.array(treeNodeSchema).optional(),
}))

/** Which checked nodes a checkable tree reports: every node, leaves only, or the topmost fully checked ones. */
export const TREE_CHECK_STRATEGIES = ['all', 'leaf', 'parent'] as const
export type TreeCheckStrategy = typeof TREE_CHECK_STRATEGIES[number]
