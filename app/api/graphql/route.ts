import { createYoga } from 'graphql-yoga'
import { schema } from '@/lib/graphql/schema'

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },
})

export { handleRequest as GET, handleRequest as POST }
