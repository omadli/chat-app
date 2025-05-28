// src/components/UserProfileModal.jsx
import { Download, Mail, FileText, Phone } from "lucide-react";

const UserProfileModal = ({ user }) => {
  if (!user) return null;

  const handleDownloadImage = () => {
    if (!user.profile_pic_url || user.profile_pic_url.endsWith("avatar.png")) {
      alert("No custom profile picture to download.");
      return;
    }
    const link = document.createElement("a");
    link.href = user.profile_pic_url;
    const filename = `${
      user.username || user.first_name || "user"
    }_profile_pic.png`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center">
        <div className="relative group">
          <img
            src={user.profile_pic_url || "/avatar.png"}
            alt={`${user.full_name || user.username}'s profile`}
            className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-base-300 shadow-md"
          />
          {user.profile_pic_url &&
            !user.profile_pic_url.endsWith("avatar.png") && (
              <button
                onClick={handleDownloadImage}
                title="Download profile picture"
                className="absolute bottom-1 right-1 btn btn-primary btn-circle btn-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-base-content">
          {user.full_name || "User"}
        </h2>
        {user.username && (
          <p className="text-sm text-base-content/70">@{user.username}</p>
        )}
      </div>

      <div className="space-y-3 pt-2 border-t border-base-300">
        {user.email && (
          <div className="flex items-center gap-3 p-2 rounded-md hover:bg-base-200/50 transition-colors">
            <Mail className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm text-base-content break-all">
              {user.email}
            </span>
          </div>
        )}
        {(user.profile?.phone_number || user.phone_number) && (
          <div className="flex items-center gap-3 p-2 rounded-md hover:bg-base-200/50 transition-colors">
            <Phone className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm text-base-content">
              {user.profile?.phone_number || user.phone_number}
            </span>
          </div>
        )}
        {(user.profile?.bio || user.bio) && (
          <div className="flex items-start gap-3 p-2 rounded-md hover:bg-base-200/50 transition-colors">
            <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
            <p className="text-sm text-base-content whitespace-pre-wrap">
              {user.profile?.bio || user.bio}
            </p>
          </div>
        )}
        {!(user.profile?.bio || user.bio) && (
          <div className="flex items-start gap-3 p-2">
            <FileText className="w-5 h-5 text-base-content/40 flex-shrink-0 mt-1" />
            <p className="text-sm text-base-content/60 italic">
              No bio available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;