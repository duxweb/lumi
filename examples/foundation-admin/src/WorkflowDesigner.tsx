import type { ReactElement } from 'react'

export function WorkflowDesigner(props: { title?: string, workflowId: number }): ReactElement {
  return (
    <section data-testid="workflow-designer">
      <h2>{props.title ?? 'Workflow Designer'}</h2>
      <p>
        Workflow #
        {props.workflowId}
        : Request → Review → Approved
      </p>
    </section>
  )
}
