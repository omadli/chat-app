import { useState, useEffect } from "react";
import {
  Camera,
  User,
  Save,
  Edit3,
  Phone,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();

  const [selectedImgPreview, setSelectedImgPreview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    bio: "",
  });
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    if (authUser) {
      setSelectedImgPreview(authUser.profile_pic_url || "/avatar.png");
      setFormData({
        first_name: authUser.first_name || "",
        last_name: authUser.last_name || "",
        phone_number: authUser.profile?.phone_number || "",
        bio: authUser.profile?.bio || "",
      });
    }
  }, [authUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImgPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitChanges = async (e) => {
    e.preventDefault();
    const dataToUpdate = new FormData();
    dataToUpdate.append("first_name", formData.first_name);
    dataToUpdate.append("last_name", formData.last_name);
    dataToUpdate.append("phone_number", formData.phone_number);
    dataToUpdate.append("bio", formData.bio);
    const imageInput = document.getElementById("avatar-upload");
    if (imageInput && imageInput.files[0]) {
      dataToUpdate.append("new_profile_pic", imageInput.files[0]);
    }
    try {
      await updateProfile(dataToUpdate);
      setIsEditing(false);
    } catch (error) {
      console.error("Profile update failed on page:", error);
    }
  };

  const toggleImageModal = () => {
    setIsImageModalOpen(!isImageModalOpen);
  };

  if (!authUser && !isUpdatingProfile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="size-10 animate-spin" />
      </div>
    );
  }
  if (!authUser) {
    return (
      <div className="text-center p-10">
        User data not available. Please try logging in again.
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen pt-20 pb-10 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 sm:p-6">
          <form
            onSubmit={handleSubmitChanges}
            className="bg-base-300 rounded-xl p-6 sm:p-8 space-y-6 sm:space-y-8"
          >
            <div className="flex justify-between items-start">
              <div className="text-center flex-grow pl-10 sm:pl-12">
                <h1 className="text-2xl font-semibold">Profile</h1>
                <p className="mt-1 text-sm text-base-content/70">
                  Manage your information
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="btn btn-ghost btn-sm p-2"
                title={isEditing ? "Cancel Edit" : "Edit Profile"}
              >
                {isEditing ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Edit3 className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <img
                  src={
                    selectedImgPreview ||
                    authUser?.profile_pic_url ||
                    "/avatar.png"
                  }
                  alt="Profile"
                  className="size-28 sm:size-32 rounded-full object-cover border-4 border-base-100 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={toggleImageModal}
                />
                {isEditing && (
                  <label
                    htmlFor="avatar-upload"
                    className={`
                      absolute bottom-0 right-0 sm:bottom-1 sm:right-1 bg-primary hover:bg-primary-focus
                      p-2 sm:p-2.5 rounded-full cursor-pointer transition-all duration-200
                      ${
                        isUpdatingProfile
                          ? "opacity-50 animate-pulse pointer-events-none"
                          : ""
                      }
                    `}
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-primary-content" />
                    <input
                      type="file"
                      id="avatar-upload"
                      className="hidden"
                      accept="image/png, image/jpeg, image/gif"
                      onChange={handleImageChange}
                      disabled={isUpdatingProfile || !isEditing}
                    />
                  </label>
                )}
              </div>
              {isEditing && (
                <p className="text-xs sm:text-sm text-base-content/60">
                  {isUpdatingProfile
                    ? "Uploading..."
                    : "Click camera to change photo"}
                </p>
              )}
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="form-control">
                  <label className="label pb-1">
                    <span className="label-text text-sm text-base-content/80 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> First Name
                    </span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      placeholder="John"
                      className="input input-bordered input-sm sm:input-md w-full bg-base-100"
                    />
                  ) : (
                    <p className="px-3 py-2 sm:px-4 sm:py-2.5 bg-base-200 rounded-lg border border-base-content/20 min-h-[36px] sm:min-h-[40px] text-sm sm:text-base">
                      {authUser?.first_name || (
                        <span className="italic text-base-content/50">
                          Not set
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="form-control">
                  <label className="label pb-1">
                    <span className="label-text text-sm text-base-content/80 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Last Name
                    </span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      placeholder="Doe"
                      className="input input-bordered input-sm sm:input-md w-full bg-base-100"
                    />
                  ) : (
                    <p className="px-3 py-2 sm:px-4 sm:py-2.5 bg-base-200 rounded-lg border border-base-content/20 min-h-[36px] sm:min-h-[40px] text-sm sm:text-base">
                      {authUser?.last_name || (
                        <span className="italic text-base-content/50">
                          Not set
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-sm text-base-content/80 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone Number
                  </span>
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    placeholder="e.g., +1234567890"
                    className="input input-bordered input-sm sm:input-md w-full bg-base-100"
                  />
                ) : (
                  <p className="px-3 py-2 sm:px-4 sm:py-2.5 bg-base-200 rounded-lg border border-base-content/20 min-h-[36px] sm:min-h-[40px] text-sm sm:text-base">
                    {authUser?.profile?.phone_number || (
                      <span className="italic text-base-content/50">
                        Not set
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-sm text-base-content/80 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Bio
                  </span>
                </label>
                {isEditing ? (
                  <textarea
                    name="bio"
                    value={formData.bio}
                    maxLength={255}
                    onChange={handleInputChange}
                    placeholder="Tell us about yourself..."
                    className="textarea textarea-bordered w-full bg-base-100 min-h-[80px] sm:min-h-[100px] text-sm sm:text-base"
                  />
                ) : (
                  <p className="px-3 py-2 sm:px-4 sm:py-2.5 bg-base-200 rounded-lg border border-base-content/20 min-h-[80px] sm:min-h-[100px] whitespace-pre-wrap text-sm sm:text-base">
                    {authUser?.profile?.bio || (
                      <span className="italic text-base-content/50">
                        Not set
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6 sm:mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (authUser) {
                      setFormData({
                        first_name: authUser.first_name || "",
                        last_name: authUser.last_name || "",
                        phone_number: authUser.profile?.phone_number || "",
                        bio: authUser.profile?.bio || "",
                      });
                      setSelectedImgPreview(
                        authUser.profile_pic_url || "/avatar.png"
                      );
                    }
                  }}
                  className="btn btn-ghost w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary w-full sm:w-auto"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? (
                    <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}
                  Save Changes
                </button>
              </div>
            )}

            {!isEditing && authUser && (
              <div className="mt-6 sm:mt-8 bg-base-200 rounded-xl p-4 sm:p-6">
                <h2 className="text-md sm:text-lg font-medium text-base-content mb-3 sm:mb-4">
                  Account Information
                </h2>
                <div className="space-y-2.5 text-xs sm:text-sm">
                  <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-base-300">
                    <span className="text-base-content/80">Email</span>
                    <span className="text-base-content/70">
                      {authUser.email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-base-300">
                    <span className="text-base-content/80">Member Since</span>
                    <span className="text-base-content">
                      {authUser.date_joined
                        ? new Date(authUser.date_joined).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 sm:py-2">
                    <span className="text-base-content/80">
                      Account Status
                    </span>
                    <span className="text-green-500 font-medium">Active</span>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={toggleImageModal}
        >
          <div
            className="relative max-w-xl max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={
                selectedImgPreview ||
                authUser?.profile_pic_url ||
                "/avatar.png"
              }
              alt="Profile enlarged"
              className="object-contain w-full h-full rounded-lg"
            />
            <button
              onClick={toggleImageModal}
              className="absolute top-2 right-2 btn btn-ghost btn-sm btn-circle bg-black/30 hover:bg-black/50"
              aria-label="Close image preview"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
export default ProfilePage;