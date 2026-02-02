"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Offer {
  id: number;
  book_id: number;
  buyer_user_id: string;
  seller_user_id: string;
  amount: number;
  counter_amount?: number;
  status: string;
  message?: string;
  counter_message?: string;
  last_action_by?: string;
  created_at: string;
  updated_at: string;
  book?: {
    id: number;
    title: string;
    user_id: string;
  };
}

interface NegotiationProps {
  bookId: number;
  currentUserId: string;
  userRole: 'buyer' | 'seller'; // Whether current user is the buyer or seller
  onOfferUpdate?: () => void;
}

export default function NegotiationComponent({ 
  bookId, 
  currentUserId, 
  userRole,
  onOfferUpdate 
}: NegotiationProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  
  // Counter offer states
  const [counterOffers, setCounterOffers] = useState<{[key: number]: {amount: string, message: string}}>({});

  useEffect(() => {
    fetchOffers();
  }, [bookId]);

  const fetchOffers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/offers?book_id=${bookId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setOffers(result.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitOffer = async () => {
    if (!offerAmount || Number(offerAmount) <= 0) {
      setError('Please enter a valid offer amount');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          book_id: bookId,
          amount: Number(offerAmount),
          message: offerMessage
        })
      });

      if (response.ok) {
        setOfferAmount('');
        setOfferMessage('');
        setShowOfferForm(false);
        fetchOffers();
        onOfferUpdate?.();
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to submit offer');
      }
    } catch (err) {
      setError('Failed to submit offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferAction = async (offerId: number, action: string, data?: any) => {
    setSubmitting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/offers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: offerId,
          action,
          ...data
        })
      });

      if (response.ok) {
        fetchOffers();
        onOfferUpdate?.();
        // Clear counter offer form
        setCounterOffers(prev => {
          const updated = {...prev};
          delete updated[offerId];
          return updated;
        });
      } else {
        const result = await response.json();
        setError(result.error || `Failed to ${action} offer`);
      }
    } catch (err) {
      setError(`Failed to ${action} offer`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCounterOfferResponse = async (offerId: number, action: string, newAmount?: number, message?: string) => {
    setSubmitting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/offers/${offerId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          offer_id: offerId,
          action,
          new_amount: newAmount,
          message
        })
      });

      if (response.ok) {
        fetchOffers();
        onOfferUpdate?.();
        // Clear forms
        setCounterOffers(prev => {
          const updated = {...prev};
          delete updated[offerId];
          return updated;
        });
      } else {
        const result = await response.json();
        setError(result.error || `Failed to ${action} offer`);
      }
    } catch (err) {
      setError(`Failed to ${action} offer`);
    } finally {
      setSubmitting(false);
    }
  };

  const getOfferStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600';
      case 'accepted': return 'text-green-600';
      case 'declined': return 'text-red-600';
      case 'countered': return 'text-orange-600';
      case 'buyer_countered': return 'text-purple-600';
      case 'withdrawn': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const formatOfferStatus = (status: string) => {
    switch (status) {
      case 'open': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'declined': return 'Declined';
      case 'countered': return 'Seller Countered';
      case 'buyer_countered': return 'Buyer Countered';
      case 'withdrawn': return 'Withdrawn';
      default: return status;
    }
  };

  if (loading) {
    return <div className="p-4">Loading offers...</div>;
  }

  const userOffers = offers.filter(offer => 
    offer.buyer_user_id === currentUserId || offer.seller_user_id === currentUserId
  );

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-black">Negotiations</h3>
        {userRole === 'buyer' && !showOfferForm && (
          <button
            onClick={() => setShowOfferForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Make Offer
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Offer Form */}
      {showOfferForm && (
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <h4 className="font-semibold mb-3 text-black">Make an Offer</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Offer Amount ($)
              </label>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                placeholder="Enter your offer"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Message (optional)
              </label>
              <textarea
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                rows={3}
                placeholder="Add a message to your offer..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={submitOffer}
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Offer'}
              </button>
              <button
                onClick={() => {
                  setShowOfferForm(false);
                  setOfferAmount('');
                  setOfferMessage('');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offers List */}
      <div className="space-y-4">
        {userOffers.length === 0 ? (
          <p className="text-black text-center py-4">No offers yet</p>
        ) : (
          userOffers.map((offer) => (
            <div key={offer.id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium text-black">
                    Original Offer: ${offer.amount}
                    {offer.counter_amount && (
                      <span className="ml-2 text-orange-600">
                        → Counter: ${offer.counter_amount}
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${getOfferStatusColor(offer.status)}`}>
                    Status: {formatOfferStatus(offer.status)}
                  </div>
                  <div className="text-xs text-black">
                    {new Date(offer.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {offer.message && (
                <div className="mb-2">
                  <div className="text-sm text-black">
                    <strong>Message:</strong> {offer.message}
                  </div>
                </div>
              )}

              {offer.counter_message && (
                <div className="mb-2">
                  <div className="text-sm text-orange-600">
                    <strong>Counter Message:</strong> {offer.counter_message}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-3 space-y-2">
                {/* Seller Actions */}
                {userRole === 'seller' && offer.status === 'open' && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleOfferAction(offer.id, 'accept')}
                      disabled={submitting}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleOfferAction(offer.id, 'decline')}
                      disabled={submitting}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Decline
                    </button>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="Counter amount"
                        value={counterOffers[offer.id]?.amount || ''}
                        onChange={(e) => setCounterOffers(prev => ({
                          ...prev,
                          [offer.id]: { ...prev[offer.id], amount: e.target.value }
                        }))}
                        className="px-2 py-1 border rounded text-sm w-32 text-black"
                        min="0"
                        step="0.01"
                      />
                      <input
                        type="text"
                        placeholder="Message"
                        value={counterOffers[offer.id]?.message || ''}
                        onChange={(e) => setCounterOffers(prev => ({
                          ...prev,
                          [offer.id]: { ...prev[offer.id], message: e.target.value }
                        }))}
                        className="px-2 py-1 border rounded text-sm w-32 text-black"
                      />
                      <button
                        onClick={() => handleOfferAction(offer.id, 'counter', {
                          counter_amount: Number(counterOffers[offer.id]?.amount),
                          counter_message: counterOffers[offer.id]?.message
                        })}
                        disabled={submitting || !counterOffers[offer.id]?.amount}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                      >
                        Counter
                      </button>
                    </div>
                  </div>
                )}

                {/* Seller actions for buyer countered offers */}
                {userRole === 'seller' && offer.status === 'buyer_countered' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOfferAction(offer.id, 'accept')}
                      disabled={submitting}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Accept Buyer's Counter
                    </button>
                    <button
                      onClick={() => handleOfferAction(offer.id, 'decline')}
                      disabled={submitting}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {/* Buyer Actions for Counteroffers */}
                {userRole === 'buyer' && offer.status === 'countered' && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleCounterOfferResponse(offer.id, 'accept')}
                      disabled={submitting}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Accept Counter (${offer.counter_amount})
                    </button>
                    <button
                      onClick={() => handleCounterOfferResponse(offer.id, 'decline')}
                      disabled={submitting}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Decline
                    </button>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="Your counter"
                        value={counterOffers[offer.id]?.amount || ''}
                        onChange={(e) => setCounterOffers(prev => ({
                          ...prev,
                          [offer.id]: { ...prev[offer.id], amount: e.target.value }
                        }))}
                        className="px-2 py-1 border rounded text-sm w-32 text-black"
                        min="0"
                        step="0.01"
                      />
                      <input
                        type="text"
                        placeholder="Message"
                        value={counterOffers[offer.id]?.message || ''}
                        onChange={(e) => setCounterOffers(prev => ({
                          ...prev,
                          [offer.id]: { ...prev[offer.id], message: e.target.value }
                        }))}
                        className="px-2 py-1 border rounded text-sm w-32 text-black"
                      />
                      <button
                        onClick={() => handleCounterOfferResponse(
                          offer.id, 
                          'counter_back', 
                          Number(counterOffers[offer.id]?.amount),
                          counterOffers[offer.id]?.message
                        )}
                        disabled={submitting || !counterOffers[offer.id]?.amount}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                      >
                        Counter Back
                      </button>
                    </div>
                  </div>
                )}

                {/* Buyer can withdraw open offers */}
                {userRole === 'buyer' && ['open', 'countered'].includes(offer.status) && (
                  <button
                    onClick={() => handleOfferAction(offer.id, 'withdraw')}
                    disabled={submitting}
                    className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                  >
                    Withdraw Offer
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}