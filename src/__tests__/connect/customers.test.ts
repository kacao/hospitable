import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CustomersResource } from '../../connect/resources/customers'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Customer } from '../../connect/models'
import { makeHttpClient } from '../helpers'

const customer: Customer = {
  id: 'cust-1',
  email: 'john@example.com',
  name: 'John Doe',
  phone: '+15555555555',
  ipAddress: null,
  timezone: 'UTC',
}

function listPage(data: Customer[], nextLink: string | null): ConnectPaginatedResponse<Customer> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: nextLink },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('CustomersResource', () => {
  let http: HttpClient
  let resource: CustomersResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new CustomersResource(http)
  })

  it('list() calls GET /customers and returns paginated envelope', async () => {
    const response = listPage([customer], null)
    vi.mocked(http.get).mockResolvedValue(response)
    const result = await resource.list({ perPage: 10 })
    expect(http.get).toHaveBeenCalledWith('/customers', { perPage: 10 })
    expect(result).toEqual(response)
  })

  it('create() posts body and unwraps data envelope', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: customer })
    const result = await resource.create({
      id: 'cust-1',
      email: 'john@example.com',
      name: 'John Doe',
      phone: '+15555555555',
      timezone: 'UTC',
    })
    expect(http.post).toHaveBeenCalledWith(
      '/customers',
      expect.objectContaining({ id: 'cust-1' }),
    )
    expect(result).toEqual(customer)
  })

  it('get() encodes customerId in the URL and unwraps', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: customer })
    const result = await resource.get('cust with space')
    expect(http.get).toHaveBeenCalledWith('/customers/cust%20with%20space')
    expect(result).toEqual(customer)
  })

  it('delete() calls DELETE /customers/{id}', async () => {
    vi.mocked(http.delete).mockResolvedValue(undefined)
    await resource.delete('cust-1')
    expect(http.delete).toHaveBeenCalledWith('/customers/cust-1')
  })

  it('iter() yields across pages until links.next is null', async () => {
    const c2: Customer = { ...customer, id: 'cust-2' }
    vi.mocked(http.get)
      .mockResolvedValueOnce(listPage([customer], 'https://.../page=2'))
      .mockResolvedValueOnce(listPage([c2], null))

    const out: Customer[] = []
    for await (const c of resource.iter({ perPage: 1 })) out.push(c)

    expect(out).toEqual([customer, c2])
    expect(http.get).toHaveBeenCalledTimes(2)
  })
})
