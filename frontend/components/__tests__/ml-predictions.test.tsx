/**
 * Tests for MLPredictions component
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MLPredictions } from '@/components/ml-predictions'
import * as apiClient from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

jest.mock('@/lib/api-client')
jest.mock('@/hooks/use-toast')

describe('MLPredictions', () => {
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

    beforeEach(() => {
        jest.clearAllMocks()
            ; (useToast as jest.Mock).mockReturnValue({
                toast: jest.fn(),
            })
            ; (apiClient.analyzeBin as jest.Mock).mockResolvedValue(mockAnalysis)
    })

    it('should render fill level prediction card', async () => {
        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText('Fill Level Prediction')).toBeInTheDocument()
            expect(screen.getByText('65%')).toBeInTheDocument()
        })
    })

    it('should display prediction data', async () => {
        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText(/15.5%\/hour/)).toBeInTheDocument()
            expect(screen.getByText(/2.3h/)).toBeInTheDocument()
            expect(screen.getByText(/85%/)).toBeInTheDocument()
        })
    })

    it('should render collection recommendation card', async () => {
        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText('Collection Recommendation')).toBeInTheDocument()
            expect(screen.getByText('YES')).toBeInTheDocument()
        })
    })

    it('should show medium urgency badge', async () => {
        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText('MEDIUM')).toBeInTheDocument()
        })
    })

    it('should render anomaly detection card', async () => {
        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText('Anomaly Detection')).toBeInTheDocument()
            expect(screen.getByText(/No anomalies detected/)).toBeInTheDocument()
        })
    })

    it('should display usage pattern when available', async () => {
        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText('Hourly Usage Pattern')).toBeInTheDocument()
            expect(screen.getByText('Hour 9:00')).toBeInTheDocument()
        })
    })

    it('should handle high urgency anomalies', async () => {
        const analysisWithAnomalies = {
            ...mockAnalysis,
            anomalies: [
                {
                    metric: 'temperature',
                    current_value: 45.0,
                    expected_range: [20, 30],
                    z_score: 3.5,
                    severity: 'high',
                },
            ],
        }

            ; (apiClient.analyzeBin as jest.Mock).mockResolvedValue(analysisWithAnomalies)

        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText('temperature')).toBeInTheDocument()
            expect(screen.getByText('HIGH')).toBeInTheDocument()
        })
    })

    it('should handle no collection needed recommendation', async () => {
        const analysisNoCollection = {
            ...mockAnalysis,
            collection_recommendation: {
                ...mockAnalysis.collection_recommendation,
                should_collect: false,
                urgency: 'low',
                reason: 'Bin not full for 5 hours',
                recommended_time: 'in 5 hours',
            },
        }

            ; (apiClient.analyzeBin as jest.Mock).mockResolvedValue(analysisNoCollection)

        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(screen.getByText('NO')).toBeInTheDocument()
            expect(screen.getByText('LOW')).toBeInTheDocument()
        })
    })

    it('should display error on API failure', async () => {
        const mockToast = jest.fn()
            ; (useToast as jest.Mock).mockReturnValue({
                toast: mockToast,
            })
            ; (apiClient.analyzeBin as jest.Mock).mockRejectedValue(new Error('API Error'))

        render(<MLPredictions binId="bin1" />)

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Error',
                    variant: 'destructive',
                })
            )
        })
    })

    it('should show loading state initially', () => {
        render(<MLPredictions binId="bin1" />)

        // Loading indicator should be present
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument()
    })

    it('should pass correct binId to analyzeBin', async () => {
        render(<MLPredictions binId="test-bin-123" />)

        await waitFor(() => {
            expect(apiClient.analyzeBin).toHaveBeenCalledWith('test-bin-123')
        })
    })
})
