import { z } from 'zod'

export const chartComponentDefinition = {
  props: z.strictObject({ type: z.enum(['area', 'line', 'bar', 'donut']), points: z.array(z.strictObject({ label: z.string(), value: z.number() })), ariaLabel: z.string(), valueFormat: z.enum(['number', 'currency']).optional(), locale: z.string().optional(), currency: z.string().optional(), height: z.number().positive().optional(), color: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(), dataLabel: z.string().optional(), emptyLabel: z.string().optional(), errorLabel: z.string().optional() }),
  slots: [],
  events: [],
  description: 'Accessible chart with an optional, lazily loaded rendering engine and data table fallback.',
}
export type LumiChartProps = z.input<typeof chartComponentDefinition.props>
export type LumiChartPoint = LumiChartProps['points'][number]
