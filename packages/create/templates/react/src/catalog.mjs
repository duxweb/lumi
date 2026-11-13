// The one Catalog of this app. The renderer and lumi-check both read
// this file, so a page that validates here is a page that renders.
// Framework-free on purpose: Node loads it without React.
import { lumiActionDefinitions, lumiComponentDefinitions } from '@duxweb/lumi/catalog'
import { uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'

export const catalog = defineCatalog(schema, {
  components: { ...uiComponentDefinitions, ...lumiComponentDefinitions },
  actions: lumiActionDefinitions,
})
