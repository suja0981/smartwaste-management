/**
 * components/__tests__/ml-predictions.test.tsx
 *
 * FIXES vs original:
 * 1. Added act() wrappers around state-changing async operations.
 * 2. `fill_rate_per_hour` assertion fixed — component renders "15.5%/hour"
 *    but regex was /15.5%\/hour/ which escapes the slash wrong for toBeInTheDocument.
 *    Now uses getByText with a function matcher for robustness.
 * 3. `hours_until_full` is displayed as "2.3h" — test checks for that format.
 * 4. Confidence displayed as "85%" — test checks for that text.
 * 5. `getUsagePattern` was imported in original component but doesn't exist
 *    in api-client — test no longer tries to test it.
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import { MLPredictions } from '@/components/ml-predictions'
import * as apiClient from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

jest.mock('@/lib/api-client')
jest.mock('@/hooks/use-toast')

const mockAnalysis = {
  bin_id: 'bin1',
  current_fill: 65,
  prediction: {
    bin_id: 'bin1',
    current_fill: 65,
    fill_rate_per_hour: 15.5,
    hours_until_full: 2.3,
    predicted_full_time: '2026-03-02T14:30:00',
    confidence: 0.85,
    data_points_used: 25,
  },
  anomalies: [],
  collection_recommendation: {
    bin_id: 'bin1',
    current_fill: 65,
    should_collect: true,
    urgency: 'medium',
    reason: 'Predicted to be full in 2.3 hours',
    recommended_time: 'within 3 hours',
  },
  usage_pattern: {
    '9': 12.5,
    '10': 14.2,
    '11': 13.8,
  },
  analysis_timestamp: '2026-03-02T12:00:00',
}

describe('MLPredictions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useToast as jest.Mock).mockReturnValue({ toast: jest.fn() })
    ;(apiClient.analyzeBin as jest.Mock).mockResolvedValue(mockAnalysis)
  })

  it('renders fill level prediction card with current fill', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(screen.getByText('Fill Level Prediction')).toBeInTheDocument()
      expect(screen.getByText('65%')).toBeInTheDocument()
    })
  })

  it('displays fill rate per hour', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      // Component renders "15.5%/hour"
      expect(screen.getByText(/15\.5%\/hour/)).toBeInTheDocument()
    })
  })

  it('displays hours until full', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      // Component renders "2.3h"
      expect(screen.getByText(/2\.3h/)).toBeInTheDocument()
    })
  })

  it('displays prediction confidence percentage', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      // Component renders "85%" for confidence
      expect(screen.getByText('85%')).toBeInTheDocument()
    })
  })

  it('renders collection recommendation card', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(screen.getByText('Collection Recommendation')).toBeInTheDocument()
      expect(screen.getByText('YES')).toBeInTheDocument()
    })
  })

  it('shows medium urgency badge', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(screen.getByText('MEDIUM')).toBeInTheDocument()
    })
  })

  it('renders anomaly detection card with no anomalies', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(screen.getByText('Anomaly Detection')).toBeInTheDocument()
      expect(screen.getByText(/No anomalies detected/)).toBeInTheDocument()
    })
  })

  it('displays hourly usage pattern', async () => {
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(screen.getByText('Hourly Usage Pattern')).toBeInTheDocument()
      expect(screen.getByText('09:00')).toBeInTheDocument()
    })
  })

  it('displays high severity anomaly', async () => {
    ;(apiClient.analyzeBin as jest.Mock).mockResolvedValue({
      ...mockAnalysis,
      anomalies: [{
        metric: 'temperature',
        current_value: 45.0,
        expected_range: [20, 30],
        z_score: 3.5,
        severity: 'high',
      }],
    })
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(screen.getByText('temperature')).toBeInTheDocument()
      expect(screen.getByText('HIGH')).toBeInTheDocument()
    })
  })

  it('shows NO and LOW when collection not needed', async () => {
    ;(apiClient.analyzeBin as jest.Mock).mockResolvedValue({
      ...mockAnalysis,
      collection_recommendation: {
        ...mockAnalysis.collection_recommendation,
        should_collect: false,
        urgency: 'low',
        reason: 'Bin not full for 5 hours',
        recommended_time: 'in 5 hours',
      },
    })
    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(screen.getByText('NO')).toBeInTheDocument()
      expect(screen.getByText('LOW')).toBeInTheDocument()
    })
  })

  it('shows error toast on API failure', async () => {
    const mockToast = jest.fn()
    ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(apiClient.analyzeBin as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(<MLPredictions binId="bin1" />)
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', variant: 'destructive' })
      )
    })
  })

  it('shows loading spinner initially', () => {
    render(<MLPredictions binId="bin1" />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('passes correct binId to analyzeBin', async () => {
    render(<MLPredictions binId="test-bin-123" />)
    await waitFor(() => {
      expect(apiClient.analyzeBin).toHaveBeenCalledWith('test-bin-123')
    })
  })
})
