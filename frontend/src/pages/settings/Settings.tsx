import { useState } from 'react';
import Toast from '../../components/common/Toast';
import { useAuthContext } from '../../context/AuthContext';

export default function SettingsPage() {
  const { user, updateUserProfile, logout } = useAuthContext();
  
  // Form states
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Form error states
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('First and last name are required');
      return;
    }
    try {
      const response = await updateUserProfile({ first_name: firstName, last_name: lastName });
      if (response.status === 'success') {
        setToastType('success');
        setToastMessage('Profile updated successfully');
        setShowToast(true);
      } else {
        setToastType('error');
        setToastMessage(response.message || 'Failed to update profile');
        setShowToast(true);
      }
    } catch (error) {
      setToastType('error');
      setToastMessage('Failed to update profile');
      setShowToast(true);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    // Validate passwords
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    try {
      const response = await updateUserProfile({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      if (response.status === 'success') {
        setToastType('success');
        setToastMessage('Password changed successfully. You will be logged out.');
        setShowToast(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          logout();
        }, 1500);
      } else {
        setPasswordError(response.message || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('Failed to change password');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <section className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account information</p>
        </div>
        
        {/* Profile Settings */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Profile Information</h2>
          
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={user?.role || ''}
                disabled
                className="w-full p-2.5 border border-gray-300 bg-gray-100 rounded-lg text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">Only an Inventory Manager can change roles.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="w-full p-2.5 border border-gray-300 bg-gray-100 rounded-lg text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">Your employee ID. Contact IT support for any changes.</p>
            </div>
            <div>
              <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                id="first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
                placeholder="First name"
              />
            </div>
            <div>
              <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                id="last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
                placeholder="Last name"
              />
              {nameError && <p className="mt-1 text-sm text-red-600">{nameError}</p>}
            </div>
            
            <div className="pt-3">
              <button
                type="submit"
                className="py-2 px-3.5 text-sm  bg-[#0504AA] hover:bg-primary-dark text-white rounded-lg font-medium transition-all active:scale-95 duration-75"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
        
        {/* Password Settings */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-6">Change Password</h2>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
                placeholder="Enter current password"
              />
            </div>
            
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
                placeholder="Enter new password"
              />
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
                placeholder="Confirm new password"
              />
              {passwordError && <p className="mt-1 text-sm text-red-600">{passwordError}</p>}
            </div>
            
            <div className="pt-3">
              <button
                type="submit"
                className="py-2 px-3.5 text-sm bg-[#0504AA] hover:bg-primary-dark text-white rounded-lg font-medium transition-all active:scale-95 duration-75"
              >
                Change Password
              </button>
            </div>
          </form>
        </div>
      </section>
      
      {/* Toast notification */}
      {showToast && (
        <div className="fixed inset-x-0 top-5 flex justify-center z-50">
          <Toast
            title={toastMessage}
            type={toastType}
            isVisible={showToast}
            duration={3000}
            onClose={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
}
