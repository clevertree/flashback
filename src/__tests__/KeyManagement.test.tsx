import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KeyManagement from '@/components/KeyManagement';

// Mock the API
jest.mock('@/lib/api', () => ({
  generateKeypair: jest.fn().mockResolvedValue({
    private_key: 'test_private_key',
    public_key: 'test_public_key',
  }),
  saveIdentity: jest.fn().mockResolvedValue(undefined),
}));

describe('KeyManagement Component', () => {
  it('renders the key management component', () => {
    render(<KeyManagement />);
    expect(
      screen.getByText('Key Management')
    ).toBeInTheDocument();
  });

  it('has a generate keypair button', () => {
    render(<KeyManagement />);
    const button = screen.getByText('Generate New Keypair');
    expect(button).toBeInTheDocument();
  });

  it('generates a keypair when button is clicked', async () => {
    render(<KeyManagement />);
    const button = screen.getByText('Generate New Keypair');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/user1/)).toBeInTheDocument();
    });
  });

  it('displays identity details after generation', async () => {
    render(<KeyManagement />);
    const button = screen.getByText('Generate New Keypair');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Org1')).toBeInTheDocument();
      expect(screen.getByText('Org1MSP')).toBeInTheDocument();
    });
  });

  it('shows save button after keypair generation', async () => {
    render(<KeyManagement />);
    const button = screen.getByText('Generate New Keypair');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Save Identity')).toBeInTheDocument();
    });
  });
});
