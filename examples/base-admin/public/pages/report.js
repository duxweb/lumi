// A page written in JavaScript, served as a plain file like the JSON pages.
// The base hands this function its runtime; it returns the page component,
// which receives the route's params and query.
export default ({ React, lumi, ui }) => {
  const h = React.createElement

  return function OrderReport({ query }) {
    const orders = lumi.useList({ resource: 'orders', pagination: { page: 1, pageSize: 1 } })
    const total = orders.data?.total
    return h(
      ui.LumiCard,
      { title: 'Order report', description: query.period ? `Period ${query.period}` : 'All time' },
      h(ui.LumiText, { text: total === undefined ? 'Counting orders…' : `${total} orders in total` }),
    )
  }
}
