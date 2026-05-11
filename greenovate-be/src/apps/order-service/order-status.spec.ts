import { Test } from '@nestjs/testing';
import { OrderServiceService } from './order-service.service';
import { SupabaseService } from '../../services/supabase.service';
import { makeChain, makeSupabaseMock } from '../../../tests/fixtures/order-fixtures';

jest.mock('../../shared/http/request-downstream', () => ({
  requestDownstream: jest.fn(),
}));

describe('OrderServiceService — Status Lifecycle (OOS-213)', () => {
  let service: OrderServiceService;
  let mockReceiptsChain: ReturnType<typeof makeChain>;
  let mockTransactionsChain: ReturnType<typeof makeChain>;

  const buildSecondAdmin = () => ({
    rpc: jest.fn(),
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'receipts') return mockReceiptsChain;
      if (table === 'transactions') return mockTransactionsChain;
      return makeChain({ data: null, error: null });
    }),
  });

  beforeEach(async () => {
    mockReceiptsChain = makeChain({ data: { receipt_id: 42 }, error: null });
    mockTransactionsChain = makeChain({
      data: { status: 'paid', updated_at: '2026-05-11T13:08:00Z' },
      error: null,
    });

    const module = await Test.createTestingModule({
      providers: [
        OrderServiceService,
        {
          provide: SupabaseService,
          useValue: {
            supabase: makeSupabaseMock(),
            secondSupabaseAdmin: buildSecondAdmin(),
          },
        },
      ],
    }).compile();

    service = module.get(OrderServiceService);
  });

  // ── POS status → frontend status mapping ─────────────────────────────────────

  describe('status mapping', () => {
    const cases: Array<[string, string]> = [
      ['paid',       'Processing'],
      ['preparing',  'Processing'],
      ['ready',      'In Transit'],
      ['picked_up',  'In Transit'],
      ['delivered',  'Delivered'],
      ['cancelled',  'Cancelled'],
    ];

    test.each(cases)('maps POS status "%s" → "%s"', async (posStatus, expected) => {
      mockTransactionsChain = makeChain({
        data: { status: posStatus, updated_at: '2026-05-11T13:08:00Z' },
        error: null,
      });

      // Re-init service with updated mock
      const module = await Test.createTestingModule({
        providers: [
          OrderServiceService,
          {
            provide: SupabaseService,
            useValue: {
              supabase: makeSupabaseMock(),
              secondSupabaseAdmin: buildSecondAdmin(),
            },
          },
        ],
      }).compile();
      const svc = module.get(OrderServiceService);

      const result = await svc.getOrderStatus('0000016985');

      expect(result).not.toBeNull();
      expect(result?.status).toBe(expected);
    });

    it('defaults unknown POS statuses to "Processing"', async () => {
      mockTransactionsChain = makeChain({
        data: { status: 'unknown_future_status', updated_at: '2026-05-11T13:08:00Z' },
        error: null,
      });

      const module = await Test.createTestingModule({
        providers: [
          OrderServiceService,
          {
            provide: SupabaseService,
            useValue: {
              supabase: makeSupabaseMock(),
              secondSupabaseAdmin: buildSecondAdmin(),
            },
          },
        ],
      }).compile();

      const result = await module.get(OrderServiceService).getOrderStatus('0000016985');

      expect(result?.status).toBe('Processing');
    });
  });

  // ── rawStatus and updatedAt passthrough ───────────────────────────────────────

  describe('response fields', () => {
    it('returns rawStatus alongside the mapped status', async () => {
      const result = await service.getOrderStatus('0000016985');

      expect(result?.rawStatus).toBe('paid');
      expect(result?.status).toBe('Processing');
    });

    it('returns updatedAt from the transaction record', async () => {
      const result = await service.getOrderStatus('0000016985');

      expect(result?.updatedAt).toBe('2026-05-11T13:08:00Z');
    });
  });

  // ── Not found cases ───────────────────────────────────────────────────────────

  describe('not found cases', () => {
    it('returns null when receipt number does not exist', async () => {
      mockReceiptsChain = makeChain({ data: null, error: null });

      const module = await Test.createTestingModule({
        providers: [
          OrderServiceService,
          {
            provide: SupabaseService,
            useValue: {
              supabase: makeSupabaseMock(),
              secondSupabaseAdmin: buildSecondAdmin(),
            },
          },
        ],
      }).compile();

      const result = await module.get(OrderServiceService).getOrderStatus('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('returns null when transaction record is missing for a valid receipt', async () => {
      mockTransactionsChain = makeChain({ data: null, error: null });

      const module = await Test.createTestingModule({
        providers: [
          OrderServiceService,
          {
            provide: SupabaseService,
            useValue: {
              supabase: makeSupabaseMock(),
              secondSupabaseAdmin: buildSecondAdmin(),
            },
          },
        ],
      }).compile();

      const result = await module.get(OrderServiceService).getOrderStatus('0000016985');
      expect(result).toBeNull();
    });
  });

  // ── Terminal states ───────────────────────────────────────────────────────────

  describe('terminal states', () => {
    it.each(['delivered', 'cancelled'])(
      '"%s" is a terminal state that should stop polling on the frontend',
      async (posStatus) => {
        mockTransactionsChain = makeChain({
          data: { status: posStatus, updated_at: '2026-05-11T14:00:00Z' },
          error: null,
        });

        const module = await Test.createTestingModule({
          providers: [
            OrderServiceService,
            {
              provide: SupabaseService,
              useValue: {
                supabase: makeSupabaseMock(),
                secondSupabaseAdmin: buildSecondAdmin(),
              },
            },
          ],
        }).compile();
        const svc = module.get(OrderServiceService);

        const result = await svc.getOrderStatus('0000016985');
        const TERMINAL = new Set(['Delivered', 'Cancelled']);
        expect(TERMINAL.has(result!.status)).toBe(true);
      },
    );
  });
});
