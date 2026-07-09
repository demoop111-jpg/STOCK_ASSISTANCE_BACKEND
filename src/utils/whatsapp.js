function formatWhatsAppNumber(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function defaultSalesperson() {
  return formatWhatsAppNumber(process.env.SALESPERSON_WHATSAPP || '919999999999');
}

export function buildSalespersonWhatsAppLink(order) {
  const salesperson = formatWhatsAppNumber(order.salesPersonMobile) || defaultSalesperson();
  const text = [
    'New Booking Request',
    '',
    `Order ID: ${order.orderRequestId}`,
    '',
    `Client: ${order.clientName || 'Client'}`,
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
