
import React from 'react';
import { useLocation } from 'react-router-dom';

function ConfirmationPage() {
  const location = useLocation();
  const { paymentDetails, orderDetails } = location.state || {}; // Extracting passed state

  return (
    <div className="confirmation-page">
      <h1>Thank you. Your card payment was successful.</h1>
      <div className="confirmation-details">
        <h2>Payment Summary</h2>
        <p>Payment Total: ${paymentDetails?.total}</p>
        <p>Card: **** **** **** {paymentDetails?.cardLastFour}</p>
        <h2>Order Summary</h2>
        <p>Items Purchased: {orderDetails?.items}</p>
        <p>Total Amount: ${orderDetails?.amount}</p>
        <p>Delivery Address: {orderDetails?.deliveryAddress}</p>
        <h2>Payment Details</h2>
        <p>Payment Reference: {paymentDetails?.reference}</p>
        <p>Payment Date: {paymentDetails?.date}</p>
        <p>Payment Time: {paymentDetails?.time}</p>
        <p>Paid by: {paymentDetails?.paidBy}</p>
      </div>
    </div>
  );
}

export default ConfirmationPage;
