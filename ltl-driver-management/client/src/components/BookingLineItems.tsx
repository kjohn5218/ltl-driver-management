import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { BookingLineItem } from '../types';
import { Plus, Trash2, Upload, FileText, DollarSign, Edit3, Save, X } from 'lucide-react';

interface BookingLineItemsProps {
  bookingId: number;
  isReadOnly?: boolean; // True if booking is signed
}

interface NewLineItem {
  category: string;
  description: string;
  amount: string;
  quantity: string;
  unitPrice?: string;
  ccfsUnitNumber?: string;
}

const LINE_ITEM_CATEGORIES = [
  { value: 'fuel_surcharge', label: 'Fuel Surcharge' },
  { value: 'detention', label: 'Detention Fee' },
  { value: 'additional_stops', label: 'Additional Stops' },
  { value: 'loading_fee', label: 'Loading Fee' },
  { value: 'unloading_fee', label: 'Unloading Fee' },
  { value: 'layover', label: 'Layover Fee' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'custom', label: 'Custom Charge' }
];

export const BookingLineItems: React.FC<BookingLineItemsProps> = ({ 
  bookingId, 
  isReadOnly = false 
}) => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<NewLineItem>({
    category: '',
    description: '',
    amount: '',
    quantity: '1',
    unitPrice: '',
    ccfsUnitNumber: ''
  });
  const [editItem, setEditItem] = useState<NewLineItem>({
    category: '',
    description: '',
    amount: '',
    quantity: '1',
    unitPrice: '',
    ccfsUnitNumber: ''
  });

  // Fetch line items
  const { data: lineItems = [], isLoading } = useQuery({
    queryKey: ['bookingLineItems', bookingId],
    queryFn: async () => {
      const response = await api.get(`/bookings/${bookingId}/line-items`);
      return response.data;
    }
  });

  // Fetch booking total
  const { data: totalData } = useQuery({
    queryKey: ['bookingTotal', bookingId],
    queryFn: async () => {
      const response = await api.get(`/bookings/${bookingId}/total`);
      return response.data;
    }
  });

  // Add line item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: NewLineItem) => {
      const response = await api.post(`/bookings/${bookingId}/line-items`, {
        ...data,
        amount: parseFloat(data.amount),
        quantity: parseInt(data.quantity),
        unitPrice: data.unitPrice ? parseFloat(data.unitPrice) : undefined,
        ccfsUnitNumber: data.ccfsUnitNumber || undefined
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingLineItems', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingTotal', bookingId] });
      setShowAddForm(false);
      setNewItem({ category: '', description: '', amount: '', quantity: '1', unitPrice: '', ccfsUnitNumber: '' });
    }
  });

  // Update line item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<NewLineItem> }) => {
      const response = await api.put(`/bookings/${bookingId}/line-items/${id}`, {
        ...data,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        quantity: data.quantity ? parseInt(data.quantity) : undefined,
        unitPrice: data.unitPrice ? parseFloat(data.unitPrice) : undefined,
        ccfsUnitNumber: data.ccfsUnitNumber || undefined
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingLineItems', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingTotal', bookingId] });
      setEditingItem(null);
    }
  });

  // Delete line item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (lineItemId: number) => {
      await api.delete(`/bookings/${bookingId}/line-items/${lineItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingLineItems', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingTotal', bookingId] });
    }
  });

  // Upload receipt mutation
  const uploadReceiptMutation = useMutation({
    mutationFn: async ({ lineItemId, file }: { lineItemId: number; file: File }) => {
      const formData = new FormData();
      formData.append('receipt', file);
      const response = await api.post(`/bookings/${bookingId}/line-items/${lineItemId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingLineItems', bookingId] });
    }
  });

  const handleAddItem = () => {
    addItemMutation.mutate(newItem);
  };

  const handleEditItem = (item: BookingLineItem) => {
    setEditingItem(item.id);
    setEditItem({
      category: item.category,
      description: item.description,
      amount: item.amount.toString(),
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice?.toString() || '',
      ccfsUnitNumber: (item as any).ccfsUnitNumber || ''
    });
  };

  const handleUpdateItem = () => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem, data: editItem });
    }
  };

  const handleDeleteItem = (lineItemId: number) => {
    if (confirm('Are you sure you want to delete this line item?')) {
      deleteItemMutation.mutate(lineItemId);
    }
  };

  const handleFileUpload = (lineItemId: number, file: File) => {
    uploadReceiptMutation.mutate({ lineItemId, file });
  };

  const getCategoryLabel = (category: string) => {
    const cat = LINE_ITEM_CATEGORIES.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading line items...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Additional Charges
        </h3>
        {!isReadOnly && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Charge
          </button>
        )}
      </div>

      {/* Add new line item form */}
      {showAddForm && !isReadOnly && (
        <div className="p-4 border border-gray-300 rounded-md bg-gray-50">
          <h4 className="text-md font-medium mb-3">Add New Charge</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select category</option>
                {LINE_ITEM_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Charge description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={newItem.amount}
                onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {newItem.category === 'repairs' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CCFS Unit #
                </label>
                <input
                  type="text"
                  value={newItem.ccfsUnitNumber || ''}
                  onChange={(e) => setNewItem({ ...newItem, ccfsUnitNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter CCFS Unit #"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddItem}
              disabled={!newItem.category || !newItem.description || !newItem.amount || addItemMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addItemMutation.isPending ? 'Adding...' : 'Add Charge'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewItem({ category: '', description: '', amount: '', quantity: '1', unitPrice: '', ccfsUnitNumber: '' });
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Line items list */}
      <div className="space-y-2">
        {lineItems.map((item: BookingLineItem) => (
          <div key={item.id} className="p-4 border border-gray-200 rounded-md bg-white">
            {editingItem === item.id ? (
              /* Edit mode */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={editItem.category}
                    onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {LINE_ITEM_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editItem.description}
                    onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editItem.amount}
                    onChange={(e) => setEditItem({ ...editItem, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editItem.quantity}
                    onChange={(e) => setEditItem({ ...editItem, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {editItem.category === 'repairs' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CCFS Unit #
                    </label>
                    <input
                      type="text"
                      value={editItem.ccfsUnitNumber || ''}
                      onChange={(e) => setEditItem({ ...editItem, ccfsUnitNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter CCFS Unit #"
                    />
                  </div>
                )}
                <div className="md:col-span-2 flex gap-2">
                  <button
                    onClick={handleUpdateItem}
                    disabled={updateItemMutation.isPending}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {updateItemMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingItem(null)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{item.description}</div>
                      <div className="text-sm text-gray-500">
                        Qty: {item.quantity} • ${Number(item.amount).toFixed(2)}
                        {item.creator && (
                          <span> • Added by {item.creator.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.receiptPath && (
                    <a
                      href={`/api/bookings/${bookingId}/line-items/${item.id}/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                      title="View receipt"
                    >
                      <FileText className="w-4 h-4" />
                    </a>
                  )}
                  {!isReadOnly && (
                    <>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(item.id, file);
                        }}
                        className="hidden"
                        id={`receipt-${item.id}`}
                      />
                      <label
                        htmlFor={`receipt-${item.id}`}
                        className="cursor-pointer text-gray-600 hover:text-gray-700"
                        title="Upload receipt"
                      >
                        <Upload className="w-4 h-4" />
                      </label>
                      <button
                        onClick={() => handleEditItem(item)}
                        className="text-gray-600 hover:text-gray-700"
                        title="Edit line item"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total summary */}
      {totalData && (
        <div className="p-4 bg-gray-50 rounded-md border">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Base Rate:</span>
              <span>${Number(totalData.baseRate).toFixed(2)}</span>
            </div>
            {totalData.lineItemsTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span>Additional Charges ({totalData.lineItemsCount}):</span>
                <span>${Number(totalData.lineItemsTotal).toFixed(2)}</span>
              </div>
            )}
            <hr className="border-gray-300" />
            <div className="flex justify-between font-semibold">
              <span>Total Amount:</span>
              <span>${Number(totalData.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};