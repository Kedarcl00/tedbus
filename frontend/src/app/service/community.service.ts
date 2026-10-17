import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { url } from '../config';

const BASE = `${url}api/v1/community`;

export interface Post {
  _id: string; authorId: string; authorName: string;
  title: string; body: string; tags: string[];
  imageUrl?: string;
  likes: string[]; reportedBy: string[]; hidden: boolean;
  shareCount: number; forumTopicId?: string;
  createdAt: string;
}
export interface Comment {
  _id: string; postId: string; authorId: string; authorName: string;
  body: string; hidden: boolean; createdAt: string;
}
export interface ForumTopic {
  _id: string; title: string; description: string;
  createdBy: string; pinned: boolean; postCount: number; createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CommunityService {
  constructor(private http: HttpClient) {}

  getPosts(forumTopicId?: string, page = 1, authorId?: string, sortBy?: string): Observable<{ posts: Post[]; total: number }> {
    const params: any = { page };
    if (forumTopicId) params.forumTopicId = forumTopicId;
    if (authorId) params.authorId = authorId;
    if (sortBy) params.sortBy = sortBy;
    return this.http.get<any>(`${BASE}/posts`, { params });
  }

  getPostById(postId: string): Observable<Post> {
    return this.http.get<Post>(`${BASE}/posts/${postId}`);
  }

  getUserPosts(authorId: string, page = 1): Observable<{ posts: Post[]; total: number }> {
    return this.getPosts(undefined, page, authorId);
  }

  createPost(payload: any): Observable<Post> {
    return this.http.post<Post>(`${BASE}/posts`, payload);
  }

  updatePost(postId: string, payload: any): Observable<Post> {
    return this.http.put<Post>(`${BASE}/posts/${postId}`, payload);
  }

  deletePost(postId: string): Observable<any> {
    return this.http.delete(`${BASE}/posts/${postId}`);
  }

  likePost(postId: string, userId: string): Observable<any> {
    return this.http.post(`${BASE}/posts/${postId}/like`, { userId });
  }

  reportPost(postId: string, userId: string): Observable<any> {
    return this.http.post(`${BASE}/posts/${postId}/report`, { userId });
  }

  sharePost(postId: string): Observable<any> {
    return this.http.post(`${BASE}/posts/${postId}/share`, {});
  }

  getComments(postId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${BASE}/comments`, { params: { postId } });
  }

  createComment(payload: any): Observable<Comment> {
    return this.http.post<Comment>(`${BASE}/comments`, payload);
  }

  reportComment(commentId: string, userId: string): Observable<{ reports: number; hidden: boolean }> {
    return this.http.post<{ reports: number; hidden: boolean }>(`${BASE}/comments/${commentId}/report`, { userId });
  }

  getTopics(): Observable<ForumTopic[]> {
    return this.http.get<ForumTopic[]>(`${BASE}/topics`);
  }

  createTopic(payload: any): Observable<ForumTopic> {
    return this.http.post<ForumTopic>(`${BASE}/topics`, payload);
  }
}
