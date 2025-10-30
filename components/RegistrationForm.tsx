import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { User, Mail, Phone, Lock, Eye, EyeOff, CreditCard, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '../hooks/useIsMobile';
import { useFormik } from 'formik';
import { registrationSchema } from '@/utils/schema';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

interface RegistrationFormProps {
  isLoading?: boolean;
}

export interface RegistrationData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  studentId: string;
  nin: string;
}

export function RegistrationForm({ isLoading = false }: RegistrationFormProps) {
  const { isMobile } = useIsMobile();
  const router = useRouter();
  const { setUser } = useUser();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: 'nelson',
      email: 'nelson@gmail.com',
      phone: '08012345678',
      password: 'password',
      confirmPassword: 'password',
      studentId: '',
      nin: '',
    },
    validationSchema: registrationSchema,
    onSubmit: async (values) => {
      try {
   
        localStorage.setItem('konnect_registration_data', JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
        }));

        // Create initial user object
        setUser({
          name: values.name,
          email: values.email,
          phone: values.phone,
          role: null,
          walletAddress: '',
          balance: 0,
        });

        toast.success('Registration data saved!');
        router.push('/wallet-setup');
        
      } catch (error: any) {
        toast.error('Registration failed. Please try again.');
        console.error('Registration error:', error);
      }
    },
  });

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      formik.handleSubmit();
    }
  };

  return (
    <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.1 }}
  >
    <div className={isMobile ? 'space-y-5' : 'grid grid-cols-2 gap-6'}>
      {/* Name */}
      <div className={!isMobile ? 'col-span-2' : ''}>
        <Label style={{ color: '#B3B3B3' }}>
          Full Name <span style={{ color: '#FF4D4D' }}>*</span>
        </Label>
        <div className="relative mt-2">
          <User
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#666666' }}
          />
          <Input
            type="text"
            placeholder="Enter your full name"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="pl-10"
            style={{
              backgroundColor: '#1E1E1E',
              borderColor: formik.touched.name && formik.errors.name ? '#FF4D4D' : '#333333',
              color: '#FFFFFF',
            }}
          />
        </div>
        {formik.touched.name && formik.errors.name && (
          <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
            {formik.errors.name}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <Label style={{ color: '#B3B3B3' }}>
          Email Address <span style={{ color: '#FF4D4D' }}>*</span>
        </Label>
        <div className="relative mt-2">
          <Mail
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#666666' }}
          />
          <Input
            type="email"
            placeholder="your.email@university.edu"
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="pl-10"
            style={{
              backgroundColor: '#1E1E1E',
              borderColor: formik.touched.email && formik.errors.email ? '#FF4D4D' : '#333333',
              color: '#FFFFFF',
            }}
          />
        </div>
        {formik.touched.email && formik.errors.email && (
          <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
            {formik.errors.email}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <Label style={{ color: '#B3B3B3' }}>
          Phone Number <span style={{ color: '#FF4D4D' }}>*</span>
        </Label>
        <div className="relative mt-2">
          <Phone
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#666666' }}
          />
          <Input
            type="tel"
            placeholder="08012345678"
            name="phone"
            value={formik.values.phone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="pl-10"
            style={{
              backgroundColor: '#1E1E1E',
              borderColor: formik.touched.phone && formik.errors.phone ? '#FF4D4D' : '#333333',
              color: '#FFFFFF',
            }}
          />
        </div>
        {formik.touched.phone && formik.errors.phone && (
          <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
            {formik.errors.phone}
          </p>
        )}
        </div>
        
            {/* Password */}
            <div>
          <Label style={{ color: '#B3B3B3' }}>
            Password <span style={{ color: '#FF4D4D' }}>*</span>
          </Label>
          <div className="relative mt-2">
            <Lock
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#666666' }}
            />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              name="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              onKeyPress={handleKeyPress}
              className="pl-10 pr-10"
              style={{
                backgroundColor: '#1E1E1E',
                borderColor: formik.touched.password && formik.errors.password ? '#FF4D4D' : '#333333',
                color: '#FFFFFF',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              {showPassword ? (
                <EyeOff size={20} style={{ color: '#666666' }} />
              ) : (
                <Eye size={20} style={{ color: '#666666' }} />
              )}
            </button>
          </div>
          {formik.touched.password && formik.errors.password && (
            <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
              {formik.errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <Label style={{ color: '#B3B3B3' }}>
            Confirm Password <span style={{ color: '#FF4D4D' }}>*</span>
          </Label>
          <div className="relative mt-2">
            <Lock
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#666666' }}
            />
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              name="confirmPassword"
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              onKeyPress={handleKeyPress}
              className="pl-10 pr-10"
              style={{
                backgroundColor: '#1E1E1E',
                borderColor: formik.touched.confirmPassword && formik.errors.confirmPassword ? '#FF4D4D' : '#333333',
                color: '#FFFFFF',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              {showConfirmPassword ? (
                <EyeOff size={20} style={{ color: '#666666' }} />
              ) : (
                <Eye size={20} style={{ color: '#666666' }} />
              )}
            </button>
          </div>
          {formik.touched.confirmPassword && formik.errors.confirmPassword && (
            <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
              {formik.errors.confirmPassword}
            </p>
          )}
        </div>

      {/* Optional Fields Section */}
      <div className="col-span-2 pt-6" style={{ borderTop: '1px solid #333333' }}>
        <p className="text-sm mb-6" style={{ color: '#666666' }}>
          Optional Information
        </p>

        <div className={isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-6'}>
          {/* Student ID */}
          <div>
            <Label style={{ color: '#B3B3B3' }}>Student ID (Optional)</Label>
            <div className="relative mt-2">
              <CreditCard
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#666666' }}
              />
              <Input
                type="text"
                placeholder="Enter your student ID"
                name="studentId"
                value={formik.values.studentId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="pl-10"
                style={{
                  backgroundColor: '#1E1E1E',
                  borderColor: '#333333',
                  color: '#FFFFFF',
                }}
              />
            </div>
          </div>

          {/* NIN */}
          <div>
            <Label style={{ color: '#B3B3B3' }}>NIN (Optional)</Label>
            <div className="relative mt-2">
              <Shield
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#666666' }}
              />
              <Input
                type="text"
                placeholder="Enter your NIN"
                name="nin"
                value={formik.values.nin}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="pl-10"
                style={{
                  backgroundColor: '#1E1E1E',
                  borderColor: '#333333',
                  color: '#FFFFFF',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Continue Button */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-8"
    >
      {/* {!isMobile && (
        <div 
          className="p-4 rounded-lg mb-6"
          style={{ backgroundColor: 'rgba(90, 200, 250, 0.1)', borderLeft: '3px solid #5AC8FA' }}
        >
          <p className="text-sm" style={{ color: '#B3B3B3' }}>
            📧 We'll use your email for account verification and important updates
          </p>
        </div>
      )} */}
      
      <Button
        onClick={() => formik.handleSubmit()}
        disabled={formik.isSubmitting || isLoading}
        className="w-full"
        style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
      >
       {formik.isSubmitting || isLoading ? 'Creating Account...' : 'Create Account'}
      </Button>
    </motion.div>
  </motion.div>
  );
}
