declare module 'react-native-razorpay' {
  export type RazorpaySuccess = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  const RazorpayCheckout: {
    open: (options: Record<string, unknown>) => Promise<RazorpaySuccess>;
  };

  export default RazorpayCheckout;
}
