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
  filteredPosts: Post[] = [];
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
  newImageUrl = '';
  selectedTopicId = '';
  submitting = false;

  // Filter and search
  filterTag = '';
  searchQuery = '';
  availableTags: string[] = [];
  sortBy: 'recent' | 'popular' = 'recent';

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

  setSortBy(sort: 'recent' | 'popular'): void {
    this.sortBy = sort;
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
    this.communityService.getPosts(topicId, this.page, undefined, this.sortBy).subscribe({
      next: ({ posts, total }) => {
        this.posts = posts;
        this.total = total;
        this.extractTags();
        this.applyFilters();
        this.isLoading = false;
      },
      error: err => {
        this.error = err?.message || 'Failed to load posts';
        this.isLoading = false;
      }
    });
  }

  extractTags(): void {
    const tagSet = new Set<string>();
    this.posts.forEach(post => {
      post.tags?.forEach(tag => tagSet.add(tag));
    });
    this.availableTags = Array.from(tagSet).sort();
  }

  applyFilters(): void {
    let result = [...this.posts];
    
    // Filter by tag
    if (this.filterTag) {
      result = result.filter(p => p.tags?.includes(this.filterTag));
    }
    
    // Filter by search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.body.toLowerCase().includes(q)
      );
    }
    
    this.filteredPosts = result;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
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
      imageUrl: this.newImageUrl.trim() || null,
      forumTopicId: this.selectedTopicId || null,
    }).subscribe({
      next: post => {
        this.posts.unshift(post);
        this.extractTags();
        this.applyFilters();
        this.newTitle = '';
        this.newBody = '';
        this.newTags = '';
        this.newImageUrl = '';
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

  onEdit(postId: string): void {
    // This will be handled by the post-card component
  }

  onDelete(postId: string): void {
    this.communityService.deletePost(postId).subscribe({
      next: () => {
        this.posts = this.posts.filter(p => p._id !== postId);
        this.applyFilters();
      },
      error: err => {
        this.error = err?.message || 'Failed to delete post';
      }
    });
  }

  onPostUpdated(updatedPost: Post): void {
    const idx = this.posts.findIndex(p => p._id === updatedPost._id);
    if (idx !== -1) {
      this.posts[idx] = updatedPost;
      this.extractTags();
      this.applyFilters();
    }
  }

  topicName(id: string): string {
    return this.topics.find(t => t._id === id)?.title || '';
  }
}
