import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
  FieldPath
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export const friendService = {
  // Send a friend request
  async sendFriendRequest(requesterId: string, receiverId: string) {
    if (requesterId === receiverId) throw new Error("Cannot add yourself as friend");
    
    // Check if friendship already exists
    const existing = await this.getFriendship(requesterId, receiverId);
    if (existing) throw new Error("Friendship already exists or pending");

    const friendshipData = {
      requesterId,
      receiverId,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'friendships'), friendshipData);
    
    // Create notification for receiver
    await addDoc(collection(db, 'notifications'), {
      userId: receiverId,
      type: 'friend_request',
      title: 'คำขอเป็นเพื่อนใหม่',
      message: 'มีคนส่งคำขอเป็นเพื่อนถึงคุณ',
      read: false,
      relatedId: docRef.id,
      createdAt: serverTimestamp()
    });

    return docRef.id;
  },

  // Get friendship between two users
  async getFriendship(userId1: string, userId2: string): Promise<Friendship | null> {
    const q1 = query(
      collection(db, 'friendships'),
      where('requesterId', '==', userId1),
      where('receiverId', '==', userId2)
    );
    const q2 = query(
      collection(db, 'friendships'),
      where('requesterId', '==', userId2),
      where('receiverId', '==', userId1)
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const docs = [...snap1.docs, ...snap2.docs];

    if (docs.length === 0) return null;
    return { id: docs[0].id, ...docs[0].data() } as Friendship;
  },

  // Accept friend request
  async acceptFriendRequest(friendshipId: string, receiverId: string) {
    const docRef = doc(db, 'friendships', friendshipId);
    await updateDoc(docRef, {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
  },

  // Decline/Cancel friend request or Unfriend
  async removeFriendship(friendshipId: string) {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  },

  // Get pending requests for a user
  async getPendingRequests(userId: string) {
    const q = query(
      collection(db, 'friendships'),
      where('receiverId', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Friendship));
  },

  // Get friends list for a user
  async getFriends(userId: string) {
    const q1 = query(
      collection(db, 'friendships'),
      where('requesterId', '==', userId),
      where('status', '==', 'accepted')
    );
    const q2 = query(
      collection(db, 'friendships'),
      where('receiverId', '==', userId),
      where('status', '==', 'accepted')
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const friendIds = [
      ...snap1.docs.map(d => d.data().receiverId),
      ...snap2.docs.map(d => d.data().requesterId)
    ];

    if (friendIds.length === 0) return [];

    // Fetch user profiles for these IDs
    const usersQ = query(
      collection(db, 'users'),
      where('__name__', 'in', friendIds)
    );
    const usersSnap = await getDocs(usersQ);
    return usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Get recommended users (not friends and not pending)
  async getRecommendedUsers(userId: string, limitCount: number = 5) {
    // This is simplified. Ideally we'd filter out existing friends in the query, 
    // but Firestore "not in" is limited. We'll fetch all and filter client-side for now.
    const q = query(collection(db, 'users'), limit(20));
    const snap = await getDocs(q);
    const allUsers = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.id !== userId);

    // Get existing friendships to filter
    const qF1 = query(collection(db, 'friendships'), where('requesterId', '==', userId));
    const qF2 = query(collection(db, 'friendships'), where('receiverId', '==', userId));
    const [snapF1, snapF2] = await Promise.all([getDocs(qF1), getDocs(qF2)]);
    const relatedIds = new Set([
      ...snapF1.docs.map(d => d.data().receiverId),
      ...snapF2.docs.map(d => d.data().requesterId)
    ]);

    return allUsers.filter(u => !relatedIds.has(u.id)).slice(0, limitCount);
  }
};
