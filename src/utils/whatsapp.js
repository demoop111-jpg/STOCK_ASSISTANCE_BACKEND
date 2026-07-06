export function buildSalespersonWhatsAppLink(order) {
  const salesperson = process.env.SALESPERSON_WHATSAPP || '919999999999';
  const text = [
    'New Booking Request',
    '',
    `Order ID: ${order.orderRequestId}`,
    '',
    `Customer: ${order.customerName}`,
    `Mobile: ${order.mobile}`,
    `City: ${order.city}`,
    '',
    `Product: ${order.productCode}`,
    `Required Qty: ${order.requestedQty} ${order.requestedUnit}`,
    `Available Stock: ${order.availableStockAtBooking || 'Please check'}`,
    `Transport: ${order.transportName}`,
    order.remark ? `Remark: ${order.remark}` : '',
    '',
    'Please contact customer and confirm order.'
  ].filter(Boolean).join('\n');

  return {
    whatsappMessage: text,
    whatsappLink: `https://wa.me/${salesperson}?text=${encodeURIComponent(text)}`
  };
}
