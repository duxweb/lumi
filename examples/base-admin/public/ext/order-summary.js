// A plain ES module: no bundler, no JSX. It gets React, the Lumi hooks and the
// UI components from the base, so it shares the base's React and data cache.
export default ({ React, lumi, ui, z }) => {
  const h = React.createElement

  function OrderSummary({ props }) {
    const orders = lumi.useList({ resource: 'orders', pagination: { page: 1, pageSize: props.limit ?? 5 } })
    if (orders.isPending)
      return h(ui.LumiText, { text: 'Loading orders…', variant: 'muted' })
    const rows = orders.data?.data ?? []
    return h(ui.LumiCard, { title: props.title, description: `${orders.data?.total ?? 0} orders in total` }, h(ui.LumiTable, {
      rows,
      rowKey: 'id',
      columns: [
        { field: 'number', label: 'Order no.' },
        { field: 'customer', label: 'Customer' },
        { field: 'status', label: 'Status' },
      ],
    }))
  }

  return {
    components: {
      OrderSummary: {
        description: 'Latest orders, read with useList from the base runtime.',
        props: z.object({ title: z.string(), limit: z.number().int().positive().optional() }),
        render: OrderSummary,
      },
    },
  }
}
