export interface ForumPost {
  postId: string;
  labId: string;
  title: string;
  content: string;
  author: {
    userId: string;
    username: string;
    avatar?: string;
  };
  category: 'question' | 'discussion' | 'solution' | 'bug-report';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  views: number;
  votes: number;
  replies: ForumReply[];
  isResolved: boolean;
}

export interface ForumReply {
  replyId: string;
  postId: string;
  content: string;
  author: {
    userId: string;
    username: string;
    avatar?: string;
  };
  createdAt: Date;
  votes: number;
  isAcceptedAnswer: boolean;
}

export interface ForumUser {
  userId: string;
  username: string;
  email: string;
  avatar?: string;
  reputation: number;
  postsCount: number;
  repliesCount: number;
  joinedAt: Date;
}

export class CommunityForumManager {
  private posts: Map<string, ForumPost> = new Map();
  private users: Map<string, ForumUser> = new Map();
  private userVotes: Map<string, Set<string>> = new Map(); // postId -> Set of userIds who voted

  createPost(
    labId: string,
    title: string,
    content: string,
    userId: string,
    username: string,
    category: 'question' | 'discussion' | 'solution' | 'bug-report',
    tags: string[]
  ): ForumPost {
    const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const post: ForumPost = {
      postId,
      labId,
      title,
      content,
      author: { userId, username },
      category,
      tags,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      votes: 0,
      replies: [],
      isResolved: false,
    };

    this.posts.set(postId, post);
    this.updateUserReputation(userId, 10);
    return post;
  }

  addReply(postId: string, content: string, userId: string, username: string): ForumReply | null {
    const post = this.posts.get(postId);
    if (!post) return null;

    const replyId = `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reply: ForumReply = {
      replyId,
      postId,
      content,
      author: { userId, username },
      createdAt: new Date(),
      votes: 0,
      isAcceptedAnswer: false,
    };

    post.replies.push(reply);
    post.updatedAt = new Date();
    this.updateUserReputation(userId, 5);

    return reply;
  }

  markAsAccepted(postId: string, replyId: string, userId: string): boolean {
    const post = this.posts.get(postId);
    if (!post || post.author.userId !== userId) return false;

    const reply = post.replies.find((r) => r.replyId === replyId);
    if (!reply) return false;

    reply.isAcceptedAnswer = true;
    post.isResolved = true;
    this.updateUserReputation(reply.author.userId, 25);

    return true;
  }

  votePost(postId: string, userId: string): boolean {
    const post = this.posts.get(postId);
    if (!post) return false;

    const votesKey = `${postId}-votes`;
    let votes = this.userVotes.get(votesKey);
    if (!votes) {
      votes = new Set();
      this.userVotes.set(votesKey, votes);
    }

    if (votes.has(userId)) return false; // Already voted

    votes.add(userId);
    post.votes++;
    this.updateUserReputation(post.author.userId, 1);

    return true;
  }

  getPostsByLab(labId: string): ForumPost[] {
    return Array.from(this.posts.values())
      .filter((p) => p.labId === labId)
      .sort((a, b) => (b.isResolved ? 1 : -1) || b.votes - a.votes);
  }

  searchPosts(query: string): ForumPost[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.posts.values()).filter(
      (p) =>
        p.title.toLowerCase().includes(lowerQuery) ||
        p.content.toLowerCase().includes(lowerQuery) ||
        p.tags.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  getPostsByCategory(category: string): ForumPost[] {
    return Array.from(this.posts.values()).filter((p) => p.category === category);
  }

  registerUser(userId: string, username: string, email: string): ForumUser {
    const user: ForumUser = {
      userId,
      username,
      email,
      reputation: 0,
      postsCount: 0,
      repliesCount: 0,
      joinedAt: new Date(),
    };

    this.users.set(userId, user);
    return user;
  }

  private updateUserReputation(userId: string, points: number): void {
    let user = this.users.get(userId);
    if (!user) {
      user = {
        userId,
        username: 'Unknown',
        email: '',
        reputation: 0,
        postsCount: 0,
        repliesCount: 0,
        joinedAt: new Date(),
      };
      this.users.set(userId, user);
    }

    user.reputation += points;
  }

  getTopContributors(limit: number = 10): ForumUser[] {
    return Array.from(this.users.values())
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, limit);
  }

  getStats(labId: string) {
    const labPosts = this.getPostsByLab(labId);
    const totalReplies = labPosts.reduce((sum, p) => sum + p.replies.length, 0);
    const resolvedCount = labPosts.filter((p) => p.isResolved).length;

    return {
      totalPosts: labPosts.length,
      totalReplies,
      resolvedQuestions: resolvedCount,
      unresolvedQuestions: labPosts.filter((p) => p.category === 'question' && !p.isResolved).length,
      totalViews: labPosts.reduce((sum, p) => sum + p.views, 0),
    };
  }
}

export const communityForumManager = new CommunityForumManager();
