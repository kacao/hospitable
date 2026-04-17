export { HospitableConnectClient } from './client'
export type { HospitableConnectClientConfig } from './client'

export * from './models'
export * from './resources'
export * from './webhooks'

export { ConnectFilter } from './filter'
export type { ConnectFilterOperator } from './filter'

export { paginateConnect } from './paginate'
export type { ConnectPageFetcher } from './paginate'

// `collectAll` works on any AsyncIterable (including the generator returned
// by `paginateConnect`), so it's re-exported here for namespace symmetry —
// `import { Connect } from 'hospitable'` → `Connect.collectAll(...)` just works.
export { collectAll } from '../http/paginate'
