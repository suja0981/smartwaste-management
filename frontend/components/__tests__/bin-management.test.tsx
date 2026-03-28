/**
 * Tests for BinManagementIntegrated component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BinManagementIntegrated } from '@/components/bin-management'
import * as apiClient from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

// Mock API client
jest.mock('@/lib/api-client')
jest.mock('@/hooks/use-toast')

describe('BinManagementIntegrated', () => {
    const mockBins = [
        {
            id: 'bin1',
            location: 'Downtown',
            capacity_liters: 100,
            fill_level_percent: 45,
            status: 'ok',
            latitude: 21.1458,
            longitude: 79.0882,
        },
        {
            id: 'bin2',
            location: 'Park',
            capacity_liters: 150,
            fill_level_percent: 85,
            status: 'full',
            latitude: 21.1400,
            longitude: 79.0920,
        },
    ]

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useToast as jest.Mock).mockReturnValue({
            toast: jest.fn(),
        })
        ;(apiClient.getBins as jest.Mock).mockResolvedValue(mockBins)
    })

    it('should render the component title', async () => {
        render(<BinManagementIntegrated />)

        await waitFor(() => {
            expect(screen.getByText('Bin Management')).toBeInTheDocument()
        })
    })

    it('should load and display bins', async () => {
        render(<BinManagementIntegrated />)

        await waitFor(() => {
            expect(apiClient.getBins).toHaveBeenCalled()
            expect(screen.getByText('bin1')).toBeInTheDocument()
            expect(screen.getByText('bin2')).toBeInTheDocument()
        })
    })

    it('should display bin locations', async () => {
        render(<BinManagementIntegrated />)

        await waitFor(() => {
            expect(screen.getByText('Downtown')).toBeInTheDocument()
            expect(screen.getByText('Park')).toBeInTheDocument()
        })
    })

    it('should filter bins by search term', async () => {
        render(<BinManagementIntegrated />)

        await waitFor(() => {
            expect(screen.getByText('bin1')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search bins...')
        fireEvent.change(searchInput, { target: { value: 'Park' } })

        await waitFor(() => {
            expect(screen.getByText('Park')).toBeInTheDocument()
            expect(screen.queryByText('Downtown')).not.toBeInTheDocument()
        })
    })

    it('should display error message on API failure', async () => {
        const errorMessage = 'Failed to load bins'
        ;(apiClient.getBins as jest.Mock).mockRejectedValue(new Error(errorMessage))
        const mockToast = jest.fn()
        ;(useToast as jest.Mock).mockReturnValue({
            toast: mockToast,
        })

        render(<BinManagementIntegrated />)

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Error',
                    variant: 'destructive',
                })
            )
        })
    })

    it('should display loading state initially', () => {
        render(<BinManagementIntegrated />)

        expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('should call getBins at regular intervals', async () => {
        jest.useFakeTimers()

        render(<BinManagementIntegrated />)

        await waitFor(() => {
            expect(apiClient.getBins).toHaveBeenCalled()
        })

        // Advance time by 5 seconds (polling interval)
        jest.advanceTimersByTime(5000)

        expect(apiClient.getBins).toHaveBeenCalledTimes(2)

        jest.useRealTimers()
    })
})
