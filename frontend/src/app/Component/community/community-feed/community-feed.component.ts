import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { CommunityService, Post, ForumTopic } from '../../../service/community.service';
import { AuthService } from '../../../service/auth.service';
import { PostCardComponent } from '../post-card/post-card.component';

@Component({
  selector: 'app-community-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslateModule, PostCardComponent],
  templateUrl: './community-feed.component.html',
  styleUrl: './community-feed.component.css',
})
export class CommunityFeedComponent implements OnInit {
  posts: Post[] = [];
  topics: ForumTopic[] = [];
  total = 0;
  page = 1;
  isLoading = false;
  error = '';

  // New post form
  showForm = false;
  newTitle = '';
  newBody = '';
  newTags = '';
  selectedTopicId = '';
  submitting = false;

  // Active comment box
  activeCommentPostId: string | null = null;
  commentBody = '';

  constructor(
    private communityService: CommunityService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadTopics();
    this.loadPosts();
  }

  loadTopics(): void {
    this.communityService.getTopics().subscribe({
      next: t => this.topics = t,
      error: () => {}
    });
  }

  loadPosts(topicId?: string): void {
    this.isLoading = true;
    this.error = '';
    this.communityService.getPosts(topicId, this.page).subscribe({
      next: ({ posts, total }) => {
        this.posts = posts;
        this.total = total;
        this.isLoading = false;
      },
      error: err => {
        this.error = err?.message || 'Failed to load posts';
        this.isLoading = false;
      }
    });
  }

  submitPost(): void {
    if (!this.newTitle.trim() || !this.newBody.trim()) return;
    const user = this.authService.currentUser;
    if (!user) return;

    this.submitting = true;
    const tags = this.newTags.split(',').map(t => t.trim()).filter(Boolean);
    this.communityService.createPost({
      userId: user.id,
      authorName: user.name,
      title: this.newTitle.trim(),
      body: this.newBody.trim(),
      tags,
      forumTopicId: this.selectedTopicId || null,
    }).subscribe({
      next: post => {
        this.posts.unshift(post);
        this.newTitle = '';
        this.newBody = '';
        this.newTags = '';
        this.selectedTopicId = '';
        this.showForm = false;
        this.submitting = false;
      },
      error: err => {
        this.error = err?.message || 'Could not create post. You may need a completed booking first.';
        this.submitting = false;
      }
    });
  }

  onLike(postId: string): void {
    const user = this.authService.currentUser;
    if (!user) return;
    this.communityService.likePost(postId, user.id).subscribe({
      next: ({ likes }) => {
        const p = this.posts.find(x => x._id === postId);
        if (p) p.likes = Array(likes).fill('');
      }
    });
  }

  onComment(postId: string): void {
    this.activeCommentPostId = this.activeCommentPostId === postId ? null : postId;
    this.commentBody = '';
  }

  submitComment(postId: string): void {
    if (!this.commentBody.trim()) return;
    const user = this.authService.currentUser;
    if (!user) return;
    this.communityService.createComment({
      userId: user.id,
      authorName: user.name,
      postId,
      body: this.commentBody.trim(),
    }).subscribe({
      next: () => {
        this.activeCommentPostId = null;
        this.commentBody = '';
      },
      error: err => {
        this.error = err?.message || 'Could not post comment.';
      }
    });
  }

  onShare(postId: string): void {
    this.communityService.sharePost(postId).subscribe();
    const url = `${window.location.origin}/community?post=${postId}`;
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!'));
    }
  }

  onReport(postId: string): void {
    const user = this.authService.currentUser;
    if (!user) return;
    if (!confirm('Report this post as inappropriate?')) return;
    this.communityService.reportPost(postId, user.id).subscribe({
      next: ({ hidden }) => {
        if (hidden) this.posts = this.posts.filter(p => p._id !== postId);
      }
    });
  }

  topicName(id: string): string {
    return this.topics.find(t => t._id === id)?.title || '';
  }
}
